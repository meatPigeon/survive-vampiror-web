# Reference assets

Converted/copied from the user's sibling Godot project `survive-vampiror` at commit `dc97542e57888c82ab18c6b8a47c9294192bf3bb`. `manifest.json` records the engine version and SHA-256 hashes. Noto and DejaVu license texts are retained in `fonts/`.

From the web repository, run:

```sh
npm run assets:port
```

This requires Godot 4.7.2 and the sibling source project with its imported assets. It exports authored scenes and their runtime-authored combat animation libraries through Godot's [GLTFDocument scene exporter](https://docs.godotengine.org/en/stable/classes/class_gltfdocument.html), then copies audio, fonts and UI art. It writes only this destination folder; source scenes/scripts are not edited. Normal web development/builds use the committed assets and need no Godot installation.

The web renderer uses the permanent/temporary zombie, three knight, arena environment, menu diorama, crater and tombstone GLBs. Additional component exports preserve the authored equipment/mantle/horse assets as references. Vite bundles only assets referenced by runtime source.
