import psycopg2
from psycopg2.extras import execute_values
import time
import sys

PG_HOST = '172.18.0.4'
PG_PORT = 5432
PG_USER = 'postgres'
PG_PASS = 'your-super-secret-and-long-postgres-password'

def merge_data():
    print('\n|=================================================================|')
    print('|  MERGE IMPORT SUPABASE VPS - AMAN & AUTO SKIP DUPLIKAT          |')
    print('|=================================================================|\n')
    print('🚀 Memulai proses merge dari temp_restore ke postgres...')
    start_time = time.time()
    
    try:
        conn_src = psycopg2.connect(host=PG_HOST, port=PG_PORT, dbname='temp_restore', user=PG_USER, password=PG_PASS)
        conn_dest = psycopg2.connect(host=PG_HOST, port=PG_PORT, dbname='postgres', user=PG_USER, password=PG_PASS)
    except Exception as e:
        print(f'❌ Gagal koneksi database: {e}')
        return
        
    cur_src = conn_src.cursor()
    cur_dest = conn_dest.cursor()
    
    cur_src.execute("""
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        ORDER BY table_name;
    """)
    tables = [r[0] for r in cur_src.fetchall()]
    
    if not tables:
        print('⚠️ Database temp_restore masih kosong! Silakan import file SQL ke temp_restore terlebih dahulu.')
        conn_src.close()
        conn_dest.close()
        return
        
    print(f'📦 Ditemukan {len(tables)} tabel di file backup untuk diperiksa.\n')
    
    total_inserted = 0
    total_skipped = 0
    
    for tbl in tables:
        # Periksa apakah tabel tujuan ada di database aktif
        cur_dest.execute("""
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = %s;
        """, (tbl,))
        if not cur_dest.fetchone():
            print(f'⏩ Tabel [{tbl}] tidak ada di database tujuan, lewati.')
            continue
            
        # Ambil tipe kolom di database tujuan
        cur_dest.execute("""
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = %s
            ORDER BY ordinal_position;
        """, (tbl,))
        dest_col_info = cur_dest.fetchall()
        dest_cols_ordered = [r[0] for r in dest_col_info]
        dest_col_types = {r[0]: r[1] for r in dest_col_info}
        
        # Ambil kolom di tabel sumber
        cur_src.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = %s;
        """, (tbl,))
        src_cols = set(r[0] for r in cur_src.fetchall())
        
        common_cols = [c for c in dest_cols_ordered if c in src_cols]
        if not common_cols:
            continue
            
        # Untuk kolom jsonb, ambil sebagai teks agar tidak bentrok dengan ARRAY di Python
        src_select_parts = []
        for c in common_cols:
            if dest_col_types.get(c) == 'jsonb':
                src_select_parts.append(f'"{c}"::text AS "{c}"')
            else:
                src_select_parts.append(f'"{c}"')
        src_select_str = ', '.join(src_select_parts)
        
        dest_cols_str = ', '.join([f'"{c}"' for c in common_cols])
        
        # Template parameter untuk execute_values
        template_parts = []
        for c in common_cols:
            if dest_col_types.get(c) == 'jsonb':
                template_parts.append('%s::jsonb')
            else:
                template_parts.append('%s')
        template_str = '(' + ', '.join(template_parts) + ')'
        
        cur_src.execute(f'SELECT count(*) FROM public."{tbl}";')
        src_count = cur_src.fetchone()[0]
        if src_count == 0:
            continue
            
        cur_dest.execute(f'SELECT count(*) FROM public."{tbl}";')
        before_count = cur_dest.fetchone()[0]
        
        # ON CONFLICT DO NOTHING tanpa spesifikasi target menangani SEMUA unique constraint/index
        conflict_clause = 'ON CONFLICT DO NOTHING'
            
        insert_query = f'INSERT INTO public."{tbl}" ({dest_cols_str}) VALUES %s {conflict_clause}'
        
        cur_src.execute(f'SELECT {src_select_str} FROM public."{tbl}";')
        
        batch_size = 5000
        has_error = False
        while True:
            rows = cur_src.fetchmany(batch_size)
            if not rows:
                break
            try:
                execute_values(cur_dest, insert_query, rows, template=template_str, page_size=batch_size)
                conn_dest.commit()
            except Exception as ex:
                conn_dest.rollback()
                print(f'⚠️ Warning pada tabel {tbl}: {ex}')
                has_error = True
                break
            
        cur_dest.execute(f'SELECT count(*) FROM public."{tbl}";')
        after_count = cur_dest.fetchone()[0]
        inserted = after_count - before_count
        skipped = src_count - inserted
        
        total_inserted += inserted
        total_skipped += skipped
        
        status_icon = '✅' if inserted > 0 else 'ℹ️'
        print(f'{status_icon} [{tbl}]: ({src_count:,} baris sumber) -> +{inserted:,} baru, {skipped:,} dilewati')
        sys.stdout.flush()
        
    # Sinkronisasi auto-increment ID sequence
    print('\n🔄 Mengupdate sequence auto-increment ID...')
    cur_dest.execute("""
        SELECT 
            'SELECT setval(' || quote_literal(quote_ident(s.relname)) || ', COALESCE(max(' || quote_ident(c.attname) || '), 1)) FROM ' || quote_ident(t.relname) || ';'
        FROM pg_class t
        JOIN pg_attribute c ON c.attrelid = t.oid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        JOIN pg_depend d ON d.refobjid = t.oid AND d.refobjsubid = c.attnum
        JOIN pg_class s ON s.oid = d.objid
        WHERE n.nspname = 'public' AND s.relkind = 'S' AND t.relkind = 'r';
    """)
    seq_commands = cur_dest.fetchall()
    for cmd in seq_commands:
        try:
            cur_dest.execute(cmd[0])
            conn_dest.commit()
        except Exception:
            pass
            
    conn_src.close()
    conn_dest.close()
    
    elapsed = round(time.time() - start_time, 2)
    print(f'\n🎉 SELESAI dalam {elapsed} detik!')
    print(f'📊 Total Data Baru Masuk: {total_inserted:,}')
    print(f'📊 Total Data Duplikat Dilewati: {total_skipped:,}')
    sys.stdout.flush()

if __name__ == '__main__':
    merge_data()
