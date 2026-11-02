import fs from 'fs';

let content = fs.readFileSync('components/AdminDashboard.tsx', 'utf8');

const oldHeader1 = `<th className="p-5 text-xs font-bold text-gray-500 uppercase tracking-wider text-center bg-gray-50 dark:bg-gray-900">Role</th>
                                                    <th className="p-5 text-xs font-bold text-gray-500 uppercase tracking-wider text-center bg-gray-50 dark:bg-gray-900">Status</th>
                                                 </tr>`;

const newHeader1 = `<th className="p-5 text-xs font-bold text-gray-500 uppercase tracking-wider text-center bg-gray-50 dark:bg-gray-900">Role</th>
                                                    <th className="p-5 text-xs font-bold text-gray-500 uppercase tracking-wider text-center bg-gray-50 dark:bg-gray-900">Status</th>
                                                       </>
                                                    )}
                                                 </tr>`;

const oldRow1 = `                                                            {activeView === 'GUDANG_REPORT' ? (() => {
                                                               let ketStr = '';
                                                               let msku = item.sku_data || '';
                                                               let qty = item.qty || 1;
                                                               const desc = item.description || '';
                                                               
                                                               const ketMatch = desc.match(/Keterangan:\\s*([^|]*)/i);
                                                               const mskuMatch = desc.match(/MSKU:\\s*([^|]*)/i);
                                                               const qtyMatch = desc.match(/Qty:\\s*([^|]*)/i);
                                                               
                                                               if (ketMatch) ketStr = ketMatch[1].trim();
                                                               if (mskuMatch) msku = mskuMatch[1].trim();
                                                               if (qtyMatch) qty = qtyMatch[1].trim();
                                                               
                                                               if (!ketStr && desc) ketStr = desc.replace(/\\[REPORT\\]\\s*/gi, '').trim();

                                                               return (
                                                                  <>
                                                                     <td className="p-4 text-sm font-mono text-gray-600 dark:text-gray-400">{item.barcode}</td>
                                                                     <td className="p-4 text-sm text-gray-600 dark:text-gray-300 max-w-xs truncate" title={ketStr}>{ketStr}</td>
                                                                     <td className="p-4 text-sm font-mono font-bold text-blue-600 dark:text-blue-400">{msku || '-'}</td>
                                                                     <td className="p-4 text-sm font-bold text-gray-700 dark:text-gray-300 text-center">{qty}</td>
                                                                  </>
                                                               );
                                                            })() : (
                                                               <>
                                                                  <td className="p-4 text-sm font-mono text-gray-600 dark:text-gray-400">{item.barcode}</td>
                                                                  <td className="p-4 text-sm text-gray-600 dark:text-gray-300 max-w-xs truncate" title={item.description}>{item.description}</td>
                                                                  {['PACKING_DATA', 'GUDANG_PENDING', 'GUDANG_BUNDLING', 'LEADER_2_DATA', 'SCAN_ALL'].includes(activeView) && (
                                                                     <td className="p-4 text-sm font-mono font-bold text-blue-600 dark:text-blue-400">{item.sku_data || '-'}</td>
                                                                  )}
                                                                  {['PACKING_DATA', 'GUDANG_PENDING', 'GUDANG_BUNDLING', 'LEADER_2_DATA', 'SCAN_ALL'].includes(activeView) && (
                                                                     <td className="p-4 text-sm font-bold text-gray-700 dark:text-gray-300 text-center">{item.qty || 1}</td>
                                                                  )}
                                                               </>
                                                            )}`;
const newRow1 = oldRow1.replace(
  `                                                               </>
                                                            )}`,
  `                                                               </>
                                                            )}
                                                            {/* Extra Info */}`
)

content = content.split(oldHeader1).join(newHeader1);

fs.writeFileSync('components/AdminDashboard.tsx', content);

console.log('Fixed syntax errors');
