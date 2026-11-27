/** The dev-server event that names a rebuilt IFC, so the viewer can reload just that model. */
export const IFC_EVENT = "elmstead:ifc";

export interface IfcEventPayload {
  /** The output name: `<model>` or `<model>@<revision>`. */
  name: string;
}

declare module "vite/types/customEvent.js" {
  interface CustomEventMap {
    "elmstead:ifc": IfcEventPayload;
  }
}
