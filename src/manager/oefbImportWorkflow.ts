import type React from 'react';
export type OefbImportState = { busy:boolean; found:number; selected:number; canSave:boolean; error:string };
export type OefbImportHandle = { preview:()=>Promise<void>; save:()=>Promise<boolean> };
export type OefbImportWorkflowProps = {
 sourceUrl?:string;
 workflowRef?:React.Ref<OefbImportHandle>;
 onWorkflowState?:(state:OefbImportState)=>void;
};
