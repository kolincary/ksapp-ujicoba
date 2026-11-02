import React, { useState, useEffect } from 'react';
import { Printer, Plus, Trash2, FileText, X, History, Copy, CheckCircle2 } from 'lucide-react';

interface FormItem {
   id: string;
   name: string;
   uom: string;
   qty: string;
}

const ClearableInput = ({ value, onChange, placeholder, className, type = "text", onKeyDown, ...props }: any) => {
   return (
      <div className="relative w-full">
         <input 
            type={type}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            className={className}
            onKeyDown={onKeyDown}
            {...props}
         />
         {value && (
            <button 
               type="button"
               onClick={() => onChange({ target: { value: '' } })}
               className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500 bg-transparent p-1 rounded-full focus:outline-none z-10"
            >
               <X size={14} />
            </button>
         )}
      </div>
   );
};

interface PrintFormsViewProps {
   canDevMode?: boolean;
}

export const PrintFormsView: React.FC<PrintFormsViewProps> = ({ canDevMode = false }) => {
   const [activeTab, setActiveTab] = useState<'CREATE' | 'HISTORY'>('CREATE');
   const [copies, setCopies] = useState<number>(1);
   const [history, setHistory] = useState<any[]>([]);
   const [isDevMode, setIsDevMode] = useState(false);

   useEffect(() => {
      try {
         const stored = localStorage.getItem('print_forms_history');
         if (stored) setHistory(JSON.parse(stored));
      } catch (e) { console.error('Failed to load history'); }
   }, []);

   useEffect(() => {
      if (!canDevMode) return;
      let keys = '';
      const handleKeyDown = (e: KeyboardEvent) => {
         keys += e.key;
         if (keys.length > 10) keys = keys.slice(-10);
         if (keys.toLowerCase() === 'devmodenew') setIsDevMode(true);
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
   }, [canDevMode]);

   interface FormData {
      formType: 'KEKURANGAN' | 'RETURN';
      picker: string; packing: string; checker: string; courier: string;
      penerima: string; alamat: string; telp: string; keterangan: string;
      invoice: string; tglPengiriman: string; items: FormItem[];
   }

   const defaultFormData: FormData = {
      formType: 'KEKURANGAN', picker: '', packing: '', checker: '', courier: '',
      penerima: '', alamat: '', telp: '', keterangan: 'ATK', invoice: '',
      tglPengiriman: (() => {
         const d = new Date();
         return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      })(),
      items: [{ id: Date.now().toString(), name: '', uom: '', qty: '' }]
   };

   const [formsData, setFormsData] = useState<FormData[]>([defaultFormData]);

   const handleCopiesChange = (newCopies: number) => {
      setCopies(newCopies);
      if (newCopies > formsData.length) {
         const newForms = [...formsData];
         for (let i = formsData.length; i < newCopies; i++) {
            newForms.push({ ...defaultFormData, items: [{ id: Date.now().toString() + i, name: '', uom: '', qty: '' }] });
         }
         setFormsData(newForms);
      } else if (newCopies < formsData.length) {
         setFormsData(formsData.slice(0, newCopies));
      }
   };

   const updateForm = (index: number, field: keyof FormData, value: any) => {
      const newForms = [...formsData];
      newForms[index] = { ...newForms[index], [field]: value };
      setFormsData(newForms);
   };

   const handleAddItem = (formIndex: number) => {
      const newForms = [...formsData];
      newForms[formIndex].items.push({ id: Date.now().toString(), name: '', uom: '', qty: '' });
      setFormsData(newForms);
   };

   const handleSetAllQtyToOne = () => {
      setFormsData(prev => prev.map(form => ({
         ...form,
         items: form.items.map(item => ({ ...item, qty: '1' }))
      })));
   };

   const handleRemoveItem = (formIndex: number, itemId: string) => {
      const newForms = [...formsData];
      newForms[formIndex].items = newForms[formIndex].items.filter(item => item.id !== itemId);
      setFormsData(newForms);
   };

   const handleItemChange = (formIndex: number, itemId: string, field: keyof FormItem, value: string) => {
      const newForms = [...formsData];
      newForms[formIndex].items = newForms[formIndex].items.map(item => 
         item.id === itemId ? { ...item, [field]: value } : item
      );
      setFormsData(newForms);
   };

   const handlePrint = () => {
      for (const form of formsData) {
         if (!form.invoice) {
            alert("Mohon isi nomor Invoice di semua form terlebih dahulu untuk generate QR Code!");
            return;
         }
      }

      const newEntries = formsData.map((form, i) => ({
         id: Date.now().toString() + i,
         timestamp: Date.now(),
         ...form
      }));
      const newHistory = [...newEntries, ...history].slice(0, 200); // keep last 200
      setHistory(newHistory);
      localStorage.setItem('print_forms_history', JSON.stringify(newHistory));

      const printWindow = window.open('', '_blank');
      if (!printWindow) {
         alert("Mohon izinkan pop-up untuk mencetak form.");
         return;
      }

      const htmlContent = `
         <!DOCTYPE html>
         <html>
         <head>
            <title>FORM ${formsData[0].formType} - ${formsData.map(f => f.invoice).join(' & ')}</title>
            <!-- Import QRCode JS from CDN -->
            <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
            <style>
               @page {
                  size: A4 portrait;
                  margin: 10mm;
               }
               body {
                  font-family: Arial, sans-serif;
                  margin: 0;
                  padding: 0;
                  color: #000;
                  background: #fff;
               }
               .print-wrapper {
                  width: 100%;
                  display: flex;
                  flex-direction: column;
                  gap: 5mm;
               }
               .form-container {
                  min-height: 130mm; /* Use min-height so it expands if items are many */
                  width: 100%;
                  border: 1px solid #000;
                  box-sizing: border-box;
                  page-break-inside: avoid;
               }
               .header-table {
                  width: 100%;
                  border-collapse: collapse;
                  border-bottom: 1px solid #000;
               }
               .header-table td {
                  border-right: 1px solid #000;
                  padding: 8px;
                  vertical-align: middle;
               }
               .header-table td:last-child {
                  border-right: none;
               }
               
               .form-title {
                  text-align: center;
                  font-size: 18px;
                  font-weight: bold;
                  text-transform: uppercase;
                  border-bottom: 1px solid #000;
                  padding: 8px;
               }
               
               .brand-name {
                  font-size: 24px;
                  font-weight: bold;
                  text-align: center;
               }
               
               .staff-info {
                  font-size: 10px;
                  line-height: 1.6;
               }
               .staff-info span.label {
                  display: inline-block;
                  width: 60px;
               }
               .staff-info span.val {
                  font-weight: bold;
                  text-transform: uppercase;
                  font-family: Arial, sans-serif;
               }

               .courier {
                  font-size: 18px;
                  font-weight: bold;
                  text-align: center;
               }
               
               .qr-container {
                  text-align: center;
                  display: flex;
                  justify-content: center;
                  align-items: center;
               }

               .details-table {
                  width: 100%;
                  border-collapse: collapse;
                  font-size: 12px;
               }
               .details-table td {
                  padding: 6px 8px;
                  vertical-align: top;
               }
               .details-table td.label-col {
                  width: 140px;
               }
               
               .items-container {
                  border-top: 1px solid #000;
                  margin-top: 5px;
                  padding-top: 5px;
                  padding-bottom: 10px;
               }
               
               .items-table {
                  width: 100%;
                  border-collapse: collapse;
               }
            </style>
         </head>
         <body>
            <div class="print-wrapper">
               ${formsData.map((f, i) => {
                  const formTitle = `FORM ${f.formType}`;
                  const tglParts = f.tglPengiriman.split('-');
                  const displayTgl = tglParts.length === 3 ? `${tglParts[2]}/${tglParts[1]}/${tglParts[0].slice(2)}` : f.tglPengiriman;
                  const isCompact = f.items.length > 7;
                  const rows = Math.ceil(f.items.length / 2);
                  const itemsHtml = f.items.map((item, idx) => {
                     if (isCompact) {
                        return `
                           <div style="display: flex; padding: 2px 4px; font-size: 14px; align-items: flex-start; justify-content: flex-start; gap: 8px; border-bottom: 1px dashed #eee; line-height: 1.2;">
                              <span style="font-weight: bold; word-break: break-word;">${item.name || '&nbsp;'}</span>
                              <span style="white-space: nowrap; color: #333;">${item.uom}</span>
                              <span style="white-space: nowrap; font-weight: bold; font-size: 14px;">${item.qty}</span>
                           </div>
                        `;
                     } else {
                        return `
                           <div style="display: flex; justify-content: space-between; padding: 4px 8px; font-size: 14px; border-bottom: 1px solid transparent;">
                              <span style="font-weight: bold;">${item.name || '&nbsp;'}</span>
                              <div style="display: flex; width: 120px;">
                                 <span style="width: 60px; text-align: center;">${item.uom}</span>
                                 <span style="width: 60px; text-align: center; font-weight: bold; font-size: 16px;">${item.qty}</span>
                              </div>
                           </div>
                        `;
                     }
                  }).join('');
                  return `
               <div class="form-container">
                  <div class="form-title">${formTitle}</div>
               
               <table class="header-table">
                  <tr>
                     <td style="width: 20%;" class="brand-name">JOYKO</td>
                     <td style="width: 45%;">
                        <div class="staff-info">
                           <div><span class="label">PICKER</span>: <span class="val">${f.picker}</span></div>
                           <div><span class="label">PACKING</span>: <span class="val">${f.packing}</span></div>
                           <div><span class="label">CHECKER</span>: <span class="val">${f.checker}</span></div>
                        </div>
                     </td>
                     <td style="width: 15%;" class="courier">${f.courier}</td>
                     <td style="width: 20%;">
                        <div class="qr-container" id="qrcode-${i}"></div>
                     </td>
                  </tr>
               </table>
               
               <table class="details-table">
                  <tr>
                     <td class="label-col">NAMA PENERIMA</td>
                     <td style="width: 10px;">:</td>
                     <td>${f.penerima}</td>
                  </tr>
                  <tr>
                     <td class="label-col">ALAMAT</td>
                     <td>:</td>
                     <td>${f.alamat}</td>
                  </tr>
                  <tr>
                     <td class="label-col">NO.TELP</td>
                     <td>:</td>
                     <td>${f.telp}</td>
                  </tr>
                  <tr>
                     <td class="label-col">KETERANGAN</td>
                     <td>:</td>
                     <td>${f.keterangan}</td>
                  </tr>
                  <tr>
                     <td class="label-col">INVOICE</td>
                     <td>:</td>
                     <td>
                        <div style="display: flex; justify-content: space-between;">
                           <span>${f.invoice}</span>
                           <span>TGL PENGIRIMAN &nbsp;&nbsp;&nbsp; <strong>${displayTgl}</strong></span>
                        </div>
                     </td>
                  </tr>
               </table>
               
               <div class="items-container">
                  <table class="items-table">
                     <tr>
                        <td style="padding: 4px 8px; width: 140px; font-size: 12px; vertical-align: top;">NAMA BARANG :</td>
                        <td style="padding: 0; vertical-align: top;">
                           <div style="display: ${isCompact ? 'grid' : 'block'}; grid-template-columns: ${isCompact ? '1fr 1fr' : '1fr'}; grid-template-rows: repeat(${rows}, auto); grid-auto-flow: column; gap: 0 15px; width: 100%;">
                              ${itemsHtml}
                           </div>
                        </td>
                     </tr>
                  </table>
               </div>
            </div>
            `;
            }).join('')}
            </div>
            
            <script>
               window.onload = function() {
                  const invoices = ${JSON.stringify(formsData.map(f => f.invoice))};
                  for (let i = 0; i < invoices.length; i++) {
                     new QRCode(document.getElementById("qrcode-" + i), {
                        text: invoices[i],
                        width: 64,
                        height: 64,
                        colorDark : "#000000",
                        colorLight : "#ffffff",
                        correctLevel : QRCode.CorrectLevel.L
                     });
                  }
                  
                  // Wait for QR to render, then print
                  setTimeout(function() {
                     window.print();
                  }, 500);
               };
            </script>
         </body>
         </html>
      `;

      printWindow.document.write(htmlContent);
      printWindow.document.close();
   };

   return (
      <div className="p-6 bg-gray-50 min-h-full">
         <div className="max-w-7xl mx-auto">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
               <div>
                  <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                     <FileText className="text-indigo-600" /> Pembuat Form Cetak
                  </h1>
                  <p className="text-sm text-gray-500 mt-1">Buat dan cetak form kekurangan / return dengan format standar PDF</p>
               </div>
               
               <div className="flex bg-white rounded-lg p-1 shadow-sm border border-gray-200">
                  <button 
                     onClick={() => setActiveTab('CREATE')}
                     className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition-colors ${activeTab === 'CREATE' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
                  >
                     <Plus size={16} /> Buat Form
                  </button>
                  <button 
                     onClick={() => setActiveTab('HISTORY')}
                     className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition-colors ${activeTab === 'HISTORY' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
                  >
                     <History size={16} /> Riwayat Form
                  </button>
               </div>
            </div>

            {activeTab === 'CREATE' ? (
            <div>
               <div className="flex justify-end items-center gap-4 mb-4">
                  <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-gray-200 shadow-sm">
                     <Copy size={16} className="text-gray-500" />
                     <span className="text-sm font-bold text-gray-700">Jumlah Form:</span>
                     <select 
                        value={copies} 
                        onChange={(e) => handleCopiesChange(Number(e.target.value))}
                        className="bg-gray-50 border border-gray-300 rounded px-2 py-1 text-sm font-bold outline-none"
                     >
                        <option value={1}>1 Form</option>
                        <option value={2}>2 Form (1 Kertas)</option>
                     </select>
                  </div>
                  <button 
                     onClick={handlePrint}
                     className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-indigo-200 transition-all"
                  >
                     <Printer size={18} /> Cetak Form & PDF
                  </button>
               </div>

            {formsData.map((formData, formIndex) => (
            <div key={formIndex} className="mb-8">
               {formsData.length > 1 && (
                  <h2 className="text-xl font-bold text-gray-700 mb-4 border-b pb-2">Form {formIndex + 1}</h2>
               )}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
               <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col lg:col-span-4">
                  <div className="bg-gray-50 border-b border-gray-200 px-4 py-3 font-bold text-gray-700 flex items-center gap-2">
                     Informasi Utama
                  </div>
                  <div className="p-5 space-y-4">
                     <div>
                        <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Tipe Form</label>
                        <select 
                           value={formData.formType} 
                           onChange={e => updateForm(formIndex, 'formType', e.target.value)}
                           className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-bold uppercase"
                        >
                           <option value="KEKURANGAN">FORM KEKURANGAN</option>
                           <option value="RETURN">FORM RETURN</option>
                        </select>
                     </div>

                     <div className="grid grid-cols-2 gap-4">
                        <div>
                           <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Kurir</label>
                           <ClearableInput 
                              type="text" 
                              value={formData.courier} 
                              onChange={(e: any) => updateForm(formIndex, 'courier', e.target.value.toUpperCase())}
                              placeholder="CONTOH: SPX, JNE, JNT, DLL"
                              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none uppercase font-bold"
                           />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Tgl Pengiriman</label>
                            <input 
                               type="date" 
                               value={formData.tglPengiriman} 
                               onChange={(e: any) => updateForm(formIndex, 'tglPengiriman', e.target.value)}
                               onMouseDown={(e) => {
                                  // Prevent browser blue text segment selection
                                  e.preventDefault();
                                  try { (e.target as any).showPicker(); } catch (err) {}
                               }}
                               onClick={(e) => {
                                  try { (e.target as any).showPicker(); } catch (err) {}
                               }}
                               onFocus={(e) => {
                                  try { (e.target as any).showPicker(); } catch (err) {}
                               }}
                               onDoubleClick={(e) => e.preventDefault()}
                               className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none select-none cursor-pointer font-bold"
                               style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
                            />
                        </div>
                     </div>

                     <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t border-gray-100">
                        <div>
                           <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Staff Picker</label>
                           <ClearableInput 
                              type="text" 
                              value={formData.picker} 
                              onChange={(e: any) => updateForm(formIndex, 'picker', e.target.value.toUpperCase())}
                              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none uppercase pr-8"
                           />
                        </div>
                        <div>
                           <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Staff Packing</label>
                           <ClearableInput 
                              type="text" 
                              value={formData.packing} 
                              onChange={(e: any) => updateForm(formIndex, 'packing', e.target.value.toUpperCase())}
                              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none uppercase pr-8"
                           />
                        </div>
                        <div>
                           <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Staff Checker</label>
                           <ClearableInput 
                              type="text" 
                              value={formData.checker} 
                              onChange={(e: any) => updateForm(formIndex, 'checker', e.target.value.toUpperCase())}
                              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none uppercase pr-8"
                           />
                        </div>
                     </div>
                  </div>
               </div>

               <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col lg:col-span-3">
                  <div className="bg-gray-50 border-b border-gray-200 px-4 py-3 font-bold text-gray-700 flex items-center gap-2">
                     Data Pesanan
                  </div>
                  <div className="p-5 space-y-4">
                     <div>
                        <label className="block text-xs font-bold text-gray-600 uppercase mb-1 text-indigo-600">No. Invoice (Barcode)</label>
                        <ClearableInput 
                           type="text" 
                           value={formData.invoice} 
                           onChange={(e: any) => updateForm(formIndex, 'invoice', e.target.value.toUpperCase())}
                           placeholder="Contoh: INV/20260817/..."
                           className="w-full border border-indigo-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-mono uppercase pr-8"
                        />
                     </div>
                     <div>
                        <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Nama Penerima</label>
                        <ClearableInput 
                           type="text" 
                           value={formData.penerima} 
                           onChange={(e: any) => updateForm(formIndex, 'penerima', e.target.value.toUpperCase())}
                           className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none uppercase pr-8"
                        />
                     </div>
                     <div>
                        <label className="block text-xs font-bold text-gray-600 uppercase mb-1">No. Telp</label>
                        <ClearableInput 
                           type="tel" 
                           value={formData.telp} 
                           onChange={(e: any) => updateForm(formIndex, 'telp', e.target.value.replace(/\D/g, ''))}
                           className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none uppercase pr-8"
                        />
                     </div>
                     <div>
                        <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Alamat Lengkap</label>
                        <div className="relative w-full">
                           <textarea 
                              value={formData.alamat} 
                              onChange={(e) => updateForm(formIndex, 'alamat', e.target.value.toUpperCase())}
                              rows={2}
                              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none uppercase pr-8"
                           />
                           {formData.alamat && (
                              <button 
                                 type="button"
                                 onClick={() => updateForm(formIndex, 'alamat', '')}
                                 className="absolute right-2 top-2 text-gray-400 hover:text-red-500 bg-transparent p-1 rounded-full focus:outline-none z-10"
                              >
                                 <X size={14} />
                              </button>
                           )}
                        </div>
                     </div>
                     <div>
                        <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Keterangan</label>
                        <ClearableInput 
                           type="text" 
                           value={formData.keterangan} 
                           onChange={(e: any) => updateForm(formIndex, 'keterangan', e.target.value.toUpperCase())}
                           className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none uppercase pr-8"
                        />
                     </div>
                  </div>
               </div>

               <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col lg:col-span-5">
               <div className="bg-gray-50 border-b border-gray-200 px-4 py-3 flex justify-between items-center">
                  <span className="font-bold text-gray-700">Daftar Barang (Item List)</span>
                  <div className="flex items-center gap-2">
                     <button 
                        type="button"
                        onClick={handleSetAllQtyToOne}
                        title="Set Qty = 1 untuk semua data barang"
                        className="text-xs font-bold bg-amber-100 text-amber-800 hover:bg-amber-200 px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
                     >
                        <CheckCircle2 size={13} /> Set All Qty = 1
                     </button>
                     <button 
                        type="button"
                        onClick={() => handleAddItem(formIndex)}
                        className="text-xs font-bold bg-indigo-100 text-indigo-700 hover:bg-indigo-200 px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
                     >
                        <Plus size={14} /> Tambah Item
                     </button>
                  </div>
               </div>
               <div className="p-5">
                  <table className="w-full text-left">
                     <thead>
                        <tr className="border-b border-gray-200 text-xs font-bold text-gray-500 uppercase">
                           <th className="pb-2 pl-2">Nama Barang</th>
                           <th className="pb-2 w-32">Satuan (UoM)</th>
                           <th className="pb-2 w-24">Qty</th>
                           <th className="pb-2 w-12"></th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-gray-100">
                        {formData.items.map((item, index) => (
                           <tr key={item.id}>
                              <td className="py-2 pr-2">
                                 <input 
                                    type="text" 
                                    value={item.name}
                                    onChange={(e) => handleItemChange(formIndex, item.id, 'name', e.target.value.toUpperCase())}
                                    placeholder="Contoh: GLUE-GS-09/1PCS"
                                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:bg-white focus:border-indigo-500 outline-none uppercase font-semibold"
                                 />
                              </td>
                              <td className="py-2 pr-2">
                                 <select 
                                    value={item.uom}
                                    onChange={(e) => handleItemChange(formIndex, item.id, 'uom', e.target.value)}
                                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2 py-2 text-sm focus:bg-white focus:border-indigo-500 outline-none text-center font-bold uppercase cursor-pointer"
                                 >
                                    <option value="">-- PILIH --</option>
                                    <option value="PCS">PCS</option>
                                    <option value="BOX">BOX</option>
                                    <option value="PACK">PACK</option>
                                    <option value="SLOP">SLOP</option>
                                    <option value="BAG">BAG</option>
                                    <option value="SET">SET</option>
                                 </select>
                              </td>
                              <td className="py-2 pr-2">
                                 <input 
                                    type="text" 
                                    inputMode="numeric"
                                    value={item.qty}
                                    onChange={(e) => handleItemChange(formIndex, item.id, 'qty', e.target.value.replace(/\D/g, ''))}
                                    placeholder="0"
                                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2 py-2 text-sm focus:bg-white focus:border-indigo-500 outline-none text-center font-bold"
                                 />
                              </td>
                              <td className="py-2 text-right">
                                 <button 
                                    type="button"
                                    onClick={() => handleRemoveItem(formIndex, item.id)}
                                    disabled={formData.items.length === 1}
                                    className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-30 transition-colors"
                                 >
                                    <Trash2 size={16} />
                                 </button>
                              </td>
                           </tr>
                        ))}
                     </tbody>
                  </table>
               </div>
               </div>
            </div>
            </div>
            ))}
            </div>
            ) : (
               <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="bg-gray-50 border-b border-gray-200 px-4 py-3 flex justify-between items-center">
                     <span className="font-bold text-gray-700">Riwayat Form Tersimpan (Local)</span>
                     {isDevMode && (
                        <button 
                           onClick={() => {
                              if(confirm('Hapus semua riwayat form?')) {
                                 setHistory([]);
                                 localStorage.removeItem('print_forms_history');
                              }
                           }}
                           className="text-xs font-bold text-red-500 hover:bg-red-50 px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
                        >
                           <Trash2 size={14} /> Hapus Semua
                        </button>
                     )}
                  </div>
                  <div className="overflow-x-auto">
                     <table className="w-full text-left text-sm">
                        <thead>
                           <tr className="border-b border-gray-200 bg-gray-50/50 text-xs font-bold text-gray-500 uppercase">
                              <th className="p-4">Tanggal Buat</th>
                              <th className="p-4">Invoice</th>
                              <th className="p-4">Penerima</th>
                              <th className="p-4">Tipe Form</th>
                              <th className="p-4">Kurir</th>
                              <th className="p-4">Tgl Pengiriman</th>
                              {isDevMode && <th className="p-4 text-right">Aksi</th>}
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                           {history.length === 0 ? (
                              <tr>
                                 <td colSpan={isDevMode ? 7 : 6} className="p-8 text-center text-gray-500">Belum ada riwayat form.</td>
                              </tr>
                           ) : (
                              history.map(item => (
                                 <tr key={item.id} className="hover:bg-gray-50">
                                    <td className="p-4">{new Date(item.timestamp).toLocaleString()}</td>
                                    <td className="p-4 font-mono font-bold">{item.invoice}</td>
                                    <td className="p-4 uppercase">{item.penerima || '-'}</td>
                                    <td className="p-4 uppercase"><span className={`px-2 py-1 rounded text-[10px] font-bold ${item.formType === 'KEKURANGAN' ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700'}`}>{item.formType}</span></td>
                                    <td className="p-4 uppercase">{item.courier || '-'}</td>
                                    <td className="p-4">{item.tglPengiriman || '-'}</td>
                                    {isDevMode && (
                                       <td className="p-4 text-right">
                                          <button 
                                             onClick={() => {
                                                const newHistory = history.filter(h => h.id !== item.id);
                                                setHistory(newHistory);
                                                localStorage.setItem('print_forms_history', JSON.stringify(newHistory));
                                             }}
                                             className="text-red-400 hover:text-red-600 p-1"
                                             title="Hapus"
                                          >
                                             <Trash2 size={16} />
                                          </button>
                                       </td>
                                    )}
                                 </tr>
                              ))
                           )}
                        </tbody>
                     </table>
                  </div>
               </div>
            )}
         </div>
      </div>
   );
};
