# FAZ 3 source model policy

The immutable FAZ13 source GLBs remain in the parent `public/models/` directory:

- `orb_faz8_web_desktop.glb`
- `orb_faz8_web_mobile.glb`

Their SHA-256 values are captured in `qa/faz-3/original_glb_hashes.sha256`.
`tools/glb_v3_pipeline.py` reads those files and deterministically creates the active
V3 assets without overwriting the originals.
