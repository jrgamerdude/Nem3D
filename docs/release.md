# Nem3D release

Nem3D bruger GitHub Releases til download og auto-update.

## Før første release

1. Installer Rust lokalt fra `https://rustup.rs/`.
2. Kør `npm install`.
3. Generer updater-nøgler:

```powershell
npm run tauri signer generate -- -w .\tauri-updater.key
```

4. Kopier public key ind i `src-tauri/tauri.conf.json` under `plugins.updater.pubkey`.
5. Gem private key som GitHub secret `TAURI_SIGNING_PRIVATE_KEY`.
6. Gem key password som GitHub secret `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`, hvis du valgte password.
7. Ret updater URL i `src-tauri/tauri.conf.json`, hvis repoet ikke hedder `Sigurd/Nem3D`.

## Udgiv en version

```powershell
git tag app-v0.1.0
git push origin app-v0.1.0
```

GitHub Action bygger Windows installer, uploader release assets og laver `latest.json` til updateren.

## Lokal build

```powershell
npm run tauri:build
```

Hvis Windows viser SmartScreen-advarsel, er det forventet i v1, fordi appen ikke er code-signed.
