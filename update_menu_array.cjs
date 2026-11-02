const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'components', 'AdminDashboard.tsx');
let content = fs.readFileSync(filePath, 'utf8');

const regex = /\{\[\s*\{\s*view:\s*'DASHBOARD'[\s\S]*?\]\.map/m;

const replacementArray = `{[
                                       { view: 'DASHBOARD', label: 'Overview Users' },
                                       { view: 'USER_MONITORING', label: 'Check Active User' },
                                       { view: 'ADMIN_NOTES', label: 'Catatan Shift & Urgent' },
                                       { view: 'SEARCH_ALL', label: 'Search Data' },
                                       { view: 'SEARCH_ALL_FIRESTORE', label: 'Search Data 2' },
                                       { view: 'PACKING_DATA', label: 'Data Packing' },
                                       { view: 'SORTIR_DATA', label: 'Data Sortir' },
                                       { view: 'PICKER_DATA', label: 'Data Picker' },
                                       { view: 'LOGISTIK_DATA', label: 'Data Logistik' },
                                       { view: 'CHECKER_DATA', label: 'Data Checker' },
                                       { view: 'LEADER_2_DATA', label: 'Rekap Leader' },
                                       { view: 'OJOL_DATA', label: 'Data Ojol' },
                                       { view: 'SCAN_ALL', label: 'Pindah Data' },
                                       { view: 'BATCH_DATA_2', label: 'Progress Order' },
                                       { view: 'BATCH_DATA_3', label: 'Batch management' },
                                       { view: 'CANCEL_DATA', label: 'Data Cancel' },
                                       { view: 'TRACK_RESI', label: 'Tracking Resi' },
                                       { view: 'PRINT_FORMS', label: 'Print Form Cetak' },
                                       { view: 'GUDANG_PENDING', label: 'Pending Scans (LT3)' },
                                       { view: 'GUDANG_READY', label: 'Resi Ready (LT3)' },
                                       { view: 'GUDANG_CANCEL', label: 'Scan Cancel (LT3)' },
                                       { view: 'GUDANG_REPORT', label: 'Gudang Report' },
                                       { view: 'GUDANG_BUNDLING', label: 'Data Bundling' },
                                       { view: 'EMPLOYEES', label: 'Data Karyawan' },
                                       { view: 'ADMIN_MANAGEMENT', label: 'Manajemen Admin' },
                                       { view: 'ACCESS', label: 'Access Control' },
                                       { view: 'PINS', label: 'PIN Management' },
                                       { view: 'PROFILE_CONFIG', label: 'Pengaturan Profil' },
                                       { view: 'BATCH_DATA', label: 'Batch Management Old' },
                                       { view: 'SUPABASE_CONFIG', label: 'DB Config' },
                                       { view: 'SUPABASE_MANAGER', label: 'Supabase Manager' },
                                       { view: 'RUNNING_TEXT_MANAGER', label: 'Pengumuman Manager' },
                                       { view: 'FIRESTORE_MANAGER', label: 'Firestore Manager' },
                                       { view: 'ADMIN_BATCH_IMPORTS', label: 'Batch Imports Manager' },
                                       { view: 'INJECT_EXPIRED_RESI', label: 'Inject Resi Kedaluwarsa' },
                                       { view: 'SETTINGS', label: 'Pengaturan Sistem' },
                                       { view: 'FAILED_SCANS', label: 'Scans Gagal' },
                                       { view: 'SYMBOLS', label: 'Simbol Terlarang' },
                                       { view: 'CHECK_INVOICE', label: 'Cek Invoice' },
                                       { view: 'COMPARE_LOGISTIK', label: 'Compare Logistik' },
                                       { view: 'COMPARE_PACKING_PICKER', label: 'Cek Resi Gaib' },
                                       { view: 'EXPORT_DATA', label: 'Export Data' },
                                       { view: 'FAKE_REPORT', label: 'Invoice Palsu' }
                                    ].map`;

content = content.replace(regex, replacementArray);

fs.writeFileSync(filePath, content);
console.log("Updated AdminDashboard.tsx array");
