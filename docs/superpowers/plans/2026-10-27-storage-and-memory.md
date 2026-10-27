# Website storage and browser memory optimization

The user asked for further optimization after the PDF capacity cleanup. Prioritize changes that preserve every lesson, pronunciation and saved learning record.

- [x] Archive 38 retired lesson MP3s and 2 unreferenced word recordings outside the published directory, verify digests, then remove only those exact files and obsolete fallback paths.
- [x] Strip repeated APIC artwork and zero padding from 204 NativeEars ID3v2.3 tags. Preserve all other metadata and prove that every audio frame/payload remains byte-identical. Keep the original prefixes and a reconstruction manifest so every original MP3 remains recoverable.
- [x] Keep the latest remote lazy JSON format after comparing every document against the original archive: all 384 sections and complete source objects remain identical. Only metadata is parsed at startup. Remove the parallel duplicate JSON format.
- [x] Load notes when opened, keep at most two completed note documents, preserve the active document and reject stale/failed requests without losing drafts.
- [x] Limit the local dictionary to four recently used alphabet shards while preserving lookup, abort/timeout and HTTP-cache behavior.
- [x] Make the offline dictionary builder read the note JSON files and retain its original word coverage. Protect JSON byte hashes from Windows line-ending conversion.
- [ ] Review the changes, run all tests that do not start an HTTP server, publish while preserving remote updates, and verify the live note and audio resources.

This optimization does not re-encode MP3 audio, lower its bit rate, remove current lesson recordings, rewrite Git history, alter textbook text, or change quiz/mastery logic. Preserve the remote lesson-recall feature and existing WAV-to-MP3 delivery build. Preserve full source backups or exact reconstruction data outside the published directory. Runtime claims will describe deferred loading/cache bounds; static byte counts are not browser heap measurements. No local server is authorized for this verification.
