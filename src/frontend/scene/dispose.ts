import * as THREE from "three";

/** Geometries and materials that several objects share, so freeing one object must leave them be. */
export type Shared = ReadonlySet<THREE.BufferGeometry | THREE.Material>;

/** A material that may carry a texture, as mesh-basic, sprite and line materials can. */
type MappedMaterial = THREE.Material & { map?: THREE.Texture | null };

/**
 * Frees the GPU resources of an object and everything under it: each mesh's geometry (Line2 and the
 * overlays' line runs are meshes too) and each material with its texture, except what is `shared`.
 * Sprites all use three.js's one quad geometry, so only their materials are freed.
 */
export function disposeTree(obj: THREE.Object3D, shared: Shared = new Set()): void {
  for (const child of obj.children) disposeTree(child, shared);
  if (obj instanceof THREE.Mesh && !shared.has(obj.geometry)) obj.geometry.dispose();
  if (!(obj instanceof THREE.Mesh || obj instanceof THREE.Sprite)) return;
  const materials: MappedMaterial[] = Array.isArray(obj.material) ? obj.material : [obj.material];
  for (const material of materials) {
    if (shared.has(material)) continue;
    material.map?.dispose();
    material.dispose();
  }
}
