import json
import struct
from pathlib import Path


def read_glb_json(path: Path) -> dict:
    data = path.read_bytes()
    _, _, _ = struct.unpack_from("<III", data, 0)
    offset = 12
    chunk_length, _ = struct.unpack_from("<II", data, offset)
    offset += 8
    return json.loads(data[offset : offset + chunk_length].decode("utf-8"))


def main() -> None:
    path = Path("apps/web/public/avatars/sara-v3.glb")
    gltf = read_glb_json(path)
    images = gltf.get("images", [])
    textures = gltf.get("textures", [])

    def image_name_for_texture(texture_index: int | None) -> str | None:
      if texture_index is None or texture_index >= len(textures):
          return None
      source = textures[texture_index].get("source")
      if source is None or source >= len(images):
          return None
      return images[source].get("name")

    material_summaries = []
    for material in gltf.get("materials", []):
        pbr = material.get("pbrMetallicRoughness", {})
        material_summaries.append(
            {
                "name": material.get("name"),
                "alphaMode": material.get("alphaMode", "OPAQUE"),
                "doubleSided": material.get("doubleSided", False),
                "roughnessFactor": pbr.get("roughnessFactor"),
                "metallicFactor": pbr.get("metallicFactor"),
                "baseColorTexture": image_name_for_texture(
                    (pbr.get("baseColorTexture") or {}).get("index")
                ),
                "normalTexture": image_name_for_texture(
                    (material.get("normalTexture") or {}).get("index")
                ),
                "metallicRoughnessTexture": image_name_for_texture(
                    (pbr.get("metallicRoughnessTexture") or {}).get("index")
                ),
                "specularColorTexture": image_name_for_texture(
                    (
                        (
                            material.get("extensions", {})
                            .get("KHR_materials_specular", {})
                            .get("specularColorTexture")
                        )
                        or {}
                    ).get("index")
                ),
            }
        )

    payload = {
        "materials": gltf.get("materials", []),
        "materialSummaries": material_summaries,
        "textures": gltf.get("textures", []),
        "images": gltf.get("images", []),
        "meshes": [
            {
                "name": mesh.get("name"),
                "primitives": len(mesh.get("primitives", [])),
            }
            for mesh in gltf.get("meshes", [])
        ],
        "nodes": [{"name": node.get("name"), "mesh": node.get("mesh")} for node in gltf.get("nodes", [])],
    }
    print(json.dumps(payload, indent=2))


if __name__ == "__main__":
    main()
