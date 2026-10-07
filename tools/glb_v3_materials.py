#!/usr/bin/env python3
from __future__ import annotations
import argparse, json, pathlib, struct, hashlib

ROOT = pathlib.Path(__file__).resolve().parents[1]

EXTENSIONS = [
    "KHR_materials_clearcoat",
    "KHR_materials_transmission",
    "KHR_materials_volume",
    "KHR_materials_ior",
    "KHR_materials_emissive_strength",
]

def srgb_channel(v: int) -> float:
    c = v / 255.0
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

def color(hex_value: str):
    h = hex_value.lstrip('#')
    return [srgb_channel(int(h[i:i+2], 16)) for i in (0, 2, 4)]

def rgba(hex_value: str, alpha=1.0):
    return [*color(hex_value), alpha]

def read_glb(path: pathlib.Path):
    raw = path.read_bytes()
    magic, version, total = struct.unpack_from('<4sII', raw, 0)
    assert magic == b'glTF' and version == 2 and total == len(raw)
    off = 12
    jlen, jtype = struct.unpack_from('<II', raw, off); off += 8
    assert jtype == 0x4E4F534A
    doc = json.loads(raw[off:off+jlen].decode('utf-8').rstrip(' \x00')); off += jlen
    blen, btype = struct.unpack_from('<II', raw, off); off += 8
    assert btype == 0x004E4942
    binary = raw[off:off+blen]
    return doc, binary

def write_glb(path: pathlib.Path, doc: dict, binary: bytes):
    js = json.dumps(doc, separators=(',', ':'), ensure_ascii=False).encode('utf-8')
    js += b' ' * ((4 - len(js) % 4) % 4)
    bin_chunk = binary + b'\x00' * ((4 - len(binary) % 4) % 4)
    total = 12 + 8 + len(js) + 8 + len(bin_chunk)
    out = bytearray(struct.pack('<4sII', b'glTF', 2, total))
    out += struct.pack('<II', len(js), 0x4E4F534A) + js
    out += struct.pack('<II', len(bin_chunk), 0x004E4942) + bin_chunk
    path.write_bytes(out)

def pbr(base, metallic, roughness, alpha=1.0):
    return {
        "baseColorFactor": rgba(base, alpha),
        "metallicFactor": metallic,
        "roughnessFactor": roughness,
    }

def set_emissive(material, hex_value, strength):
    material["emissiveFactor"] = color(hex_value)
    material.setdefault("extensions", {})["KHR_materials_emissive_strength"] = {"emissiveStrength": strength}

def set_clearcoat(material, factor, roughness):
    material.setdefault("extensions", {})["KHR_materials_clearcoat"] = {
        "clearcoatFactor": factor,
        "clearcoatRoughnessFactor": roughness,
    }

def apply(doc: dict, profile: str):
    mats = {m.get("name"): m for m in doc.get("materials", [])}
    low_mobile = profile == "mobile"

    def mat(name):
        if name not in mats: raise KeyError(name)
        m = mats[name]
        m.pop("extensions", None)
        m.pop("alphaMode", None); m.pop("alphaCutoff", None)
        m["doubleSided"] = False
        m.pop("emissiveFactor", None)
        return m

    m=mat("MAT_Shell_Graphite"); m["pbrMetallicRoughness"]=pbr("#111722",.82,.33); set_clearcoat(m,.14 if low_mobile else .20,.31)
    m=mat("MAT_Antique_Gold"); m["pbrMetallicRoughness"]=pbr("#c18a3d",1,.24); set_clearcoat(m,.10 if low_mobile else .16,.22)
    m=mat("MAT_Shell_Inner"); m["pbrMetallicRoughness"]=pbr("#0b1018",.63,.52); set_emissive(m,"#02101c",.12); set_clearcoat(m,.04 if low_mobile else .08,.46)
    m=mat("MAT_Platform_Obsidian"); m["pbrMetallicRoughness"]=pbr("#080b11",.66,.30); set_clearcoat(m,.18 if low_mobile else .32,.21)

    m=mat("MAT_Crystal_Ice"); m["pbrMetallicRoughness"]=pbr("#79c9ff",0,.095 if low_mobile else .065); m["doubleSided"]=True
    ext=m.setdefault("extensions", {}); ext["KHR_materials_transmission"]={"transmissionFactor":.52 if low_mobile else .72}; ext["KHR_materials_volume"]={"thicknessFactor":.24 if low_mobile else .34,"attenuationDistance":1.75,"attenuationColor":color("#4e8fcb")}; ext["KHR_materials_ior"]={"ior":1.46}; ext["KHR_materials_clearcoat"]={"clearcoatFactor":.24 if low_mobile else .36,"clearcoatRoughnessFactor":.08}

    m=mat("MAT_Rune_Emissive"); m["pbrMetallicRoughness"]=pbr("#8c4318",.32,.30); set_emissive(m,"#ff862b",1.12)
    m=mat("MAT_Core_InnerWhite"); m["pbrMetallicRoughness"]=pbr("#bdeeff",0,.12); set_emissive(m,"#d8f7ff",1.32)

    m=mat("MAT_EnergyWell_Blue"); m["pbrMetallicRoughness"]=pbr("#0c4da0",0,.18,.68); set_emissive(m,"#176dd8",1.02); m["alphaMode"]="BLEND"
    m=mat("MAT_Core_EnergyShell"); m["pbrMetallicRoughness"]=pbr("#1668d8",0,.12,.34); set_emissive(m,"#2898ff",1.20); m["alphaMode"]="BLEND"; m["doubleSided"]=True
    m=mat("MAT_Energy_Filament"); m["pbrMetallicRoughness"]=pbr("#4fbaff",0,.10,.80); set_emissive(m,"#4fc8ff",1.35); m["alphaMode"]="BLEND"
    m=mat("MAT_Energy_Lightning"); m["pbrMetallicRoughness"]=pbr("#b8edff",0,.08,.82); set_emissive(m,"#9fe8ff",1.55); m["alphaMode"]="BLEND"
    m=mat("MAT_Energy_Beam"); m["pbrMetallicRoughness"]=pbr("#2e96ff",0,.12,.27); set_emissive(m,"#3fb8ff",1.10); m["alphaMode"]="BLEND"; m["doubleSided"]=True
    m=mat("MAT_Core_BlueWhite"); m["pbrMetallicRoughness"]=pbr("#4a9cff",0,.12); set_emissive(m,"#8edbff",1.05)
    m=mat("MAT_Core_Halo"); m["pbrMetallicRoughness"]=pbr("#5fb9ff",0,.15,.17); set_emissive(m,"#4ba7ff",.82); m["alphaMode"]="BLEND"; m["doubleSided"]=True

    used=set(doc.get("extensionsUsed", []))
    for material in doc.get("materials", []): used.update(material.get("extensions", {}).keys())
    doc["extensionsUsed"] = sorted(used)
    extras=doc.setdefault("asset", {}).setdefault("extras", {}).setdefault("chatgptV3", {})
    extras.update({"phase":4,"materialSystem":"premium-pbr-v1","textures":False,"uvRequired":False})
    return doc

def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()

def main():
    ap=argparse.ArgumentParser(); ap.add_argument('--root', default=str(ROOT)); args=ap.parse_args(); root=pathlib.Path(args.root)
    pairs=[
      ('desktop','public/models/orb_v3_faz3_desktop.glb','public/models/orb_v3_faz4_desktop.glb'),
      ('mobile','public/models/orb_v3_faz3_mobile.glb','public/models/orb_v3_faz4_mobile.glb'),
    ]
    manifest={"phase":4,"generator":"tools/glb_v3_materials.py","models":[]}
    for profile, src_rel, dst_rel in pairs:
        src=root/src_rel; dst=root/dst_rel; doc,binary=read_glb(src); apply(doc,profile); write_glb(dst,doc,binary)
        manifest["models"].append({"profile":profile,"source":src_rel,"output":dst_rel,"bytes":dst.stat().st_size,"sha256":sha(dst),"sourceBinaryBytes":len(binary)})
    (root/'public/models/orb_v3_faz4_manifest.json').write_text(json.dumps(manifest,indent=2)+"\n")
    print(json.dumps(manifest,indent=2))
if __name__=='__main__': main()
