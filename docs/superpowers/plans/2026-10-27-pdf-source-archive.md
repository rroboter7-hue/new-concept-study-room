# Remove converted PDF binaries from the published site

- [x] Audit all 15 PDF files against converted text, textbook passages and printable-only content.
- [x] Copy 14 converted/superseded originals outside the published directory; independently verify each source and backup with SHA256 and byte count. Keep the printable writing paper public.
- [x] Record immutable archive availability without deleting source names, page references, hashes or course evidence.
- [x] Replace archived PDF reading/download links with an archive note while preserving text reading. Keep the writing-paper PDF available.
- [x] Remove only the 14 explicitly validated files from resources, saving 123,736,322 bytes.
- [x] Update the source-proof test to use the archived PDF digest, and update stale test loaders to match the current twenty-pack production bootstrap.
- [x] Run nonserver regression tests, publish while preserving remote updates, and check the live library/readers for archived links.

The complete source backups remain under the enclosing task's `work/pdf-source-archive/2026-10-27/`, with `archive-manifest.json`. Textbook passages do not reproduce every illustration, workbook exercise or printed layout; the backups preserve that material. This cleanup reduces the published working tree, and does not rewrite Git history.
