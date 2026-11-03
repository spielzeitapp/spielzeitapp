/** Bound each save stage; always tell callers whether persistence itself failed. */
export async function eventSaveTask<T>(label: string, task: PromiseLike<T>, timeoutMs = 15000): Promise<T> {
 let timer: ReturnType<typeof setTimeout> | undefined;
 try {
  return await Promise.race([Promise.resolve(task),new Promise<never>((_,reject)=>{
   timer=setTimeout(()=>reject(new Error(`${label}: Zeitüberschreitung. Bitte den gespeicherten Termin prüfen.`)),timeoutMs);
  })]);
 } finally { if(timer!==undefined)clearTimeout(timer); }
}
