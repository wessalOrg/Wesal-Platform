# CAP1 - Inventory & Comparison (read-only)

_generated: 2026-09-16 14:33:52 +03:00

## Repositories under comparison

| Role | Path | Branch | Origin |
|------|------|--------|--------|
| SOURCE (backend) | C:\Users\Mohammed Shamaa\AppData\Local\Temp\opencode\verify-api | develop | https://github.com/wessalOrg/wesal-api.git |
| SOURCE (frontend) | C:\Users\Mohammed Shamaa\AppData\Local\Temp\opencode\verify-frontend | develop | https://github.com/wessalOrg/wesal-frontend.git |
| CANONICAL (target) | C:\Users\Mohammed Shamaa\source\repos\Wesal-Platform | main | https://github.com/wessalOrg/Wesal-Platform.git |

## Coarse file counts (excluding noise dirs)

- backend (wesal-api)  -  *.cs : 394
- backend (wesal-api)  -  *.csproj : 6
- backend (wesal-api)  -  *.slnx/*.sln : 1
- backend (wesal-api)  -  packages/prop/global.json : 0
- frontend (wesal-frontend) - *.ts/*.tsx : 434
- frontend (wesal-frontend) - *.vue : 0
- frontend (wesal-frontend) - package.json : 1
- frontend (wesal-frontend) - *.jsx : 0
- canonical (Wesal-Platform) - *.cs : 285
- canonical (Wesal-Platform) - *.ts/*.tsx : 224
- canonical (Wesal-Platform) - Backend slnx/csproj : 7

## Key feature anchors present per repo (signal string search)

- SignalR hub :  [api=1]  [fe =2]  [canon=2]
- Hall creation (owner) :  [api=168]  [fe =150]  [canon=152]
- Auth / JWT / Identity :  [api=2]  [fe =0]  [canon=2]
- IdentityUser / roles :  [api=45]  [fe =0]  [canon=27]
- EF Core / migrations :  [api=18]  [fe =0]  [canon=14]
- File/photo upload :  [api=2]  [fe =3]  [canon=0]

## Open questions that block the migration matrix (to confirm with source inspection)

- For each User Story/Feature: exists in canonical? partially? missing? conflicting?
- Which repo copy is the LATEST for each feature (newer/more complete)?
- Does the canonical DB/EF model already match or need migration reconciliation?
- Are there duplicate/conflicting implementations that must be merged intentionally?

## Next step (PHASE 2) - do not start writing code yet

1. Build the migration matrix (per prior instruction) mapping each feature across the 3 repos.
2. Classify: already present / partial / missing / conflicting / obsolete.
3. Only after the matrix is complete and approved, begin PHASE 3 migrations.
