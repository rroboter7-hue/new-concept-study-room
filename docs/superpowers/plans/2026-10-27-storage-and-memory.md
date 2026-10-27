# Website storage and browser memory optimization

The user asked for further optimization after the PDF capacity cleanup. Prioritize changes that preserve every lesson, pronunciation and saved learning record.

- [ ] Archive 38 retired lesson MP3s and 2 unreferenced word recordings outside the published directory, verify digests, then remove only those exact files and obsolete fallback paths.
- [ ] Strip repeated APIC artwork and zero padding from 204 NativeEars ID3v2.3 tags. Preserve all other metadata and prove that every audio frame/payload remains byte-identical. Keep the original prefixes and a reconstruction manifest so every original MP3 remains recoverable.
- [x] Split 9 note documents into content-addressed JSON without changing any of their 384 sections; leave only a small catalogue in the initial script.
- [x] Load notes when opened, keep at most two completed note documents, preserve the active document and reject stale/failed requests without losing drafts.
- [x] Limit the local dictionary to four recently used alphabet shards while preserving lookup, abort/timeout and HTTP-cache behavior.
- [x] Make the offline dictionary builder read the note JSON files and retain its original word coverage. Protect JSON byte hashes from Windows line-ending conversion.
- [ ] Review the changes, run all tests that do not start an HTTP server, publish while preserving remote updates, and verify the live note and audio resources.

Do not re-encode audio, lower its bit rate, remove current lesson recordings, rewrite Git history, alter textbook text, or change quiz/mastery logic. Preserve full source backups or exact reconstruction data outside the published directory. Runtime claims will describe deferred loading/cache bounds; static byte counts are not browser heap measurements. No local server is authorized for this verification.
