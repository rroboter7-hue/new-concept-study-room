# Phrase-first old-knowledge recommendations

User request: recommend mainly useful earlier expressions and verbs; remove very basic words and expressions from automatic recommendations. Preserve the earlier rule that actual checked practice rotates expressions across lessons.

Use the existing source-backed old-word bank. A curated, finite exclusion list describes introductory expressions for this practice preference; it is not a CEFR assessment. Keep advanced expressions that contain simple verbs, such as take into account and put up with. Do not filter by the earliest source book or by a broad frequency threshold, since useful phrases also appear in Book1.

The writing UI uses a phrases-verbs profile: aim for three expressions and one verb among four suggestions, fill remaining spaces only with eligible expressions or verbs, and show fewer when candidates are exhausted. No nouns, adjectives, names, basic verbs or basic expressions enter this profile. Existing generic core callers keep their old behavior.

Saved recommendations must be revalidated against the profile on first entry. Persist recommendationProfile=phrases-verbs-v1 in selection metadata, so old ratios migrate once even when their individual items are still eligible. Valid saved sets stay stable while typing, switching targets and reloading. Canonicalize legitimate source aliases once without reshuffling. Replacing incompatible recommendations preserves answers, selected old expressions and checked-use history. Manual selection can still access the full word bank; current-lesson mandatory new-word practice is unchanged.

Literal introductory time phrases and basic verb inflections are part of the finite preference, while idiomatic expressions containing simple component words remain eligible. Exclude the verified capitalized lesson names Bob, Mike, Peter, Harry and Dement: their dictionary verb homographs are not the senses used in those lessons. Preserve lowercase homographs and real sentence-initial/title verbs rather than inferring all capitalization as names.

The coverage audit found unresolved source-note expressions and incomplete glosses. It must be reported honestly; this recommendation change does not constitute a full-corpus usage review, and does not expose unreviewed/OCR fragments merely to increase counts.

Acceptance: focused red/green tests for profile mix, basic exclusions including inflected forms, useful multiword expressions, short pools, rotation, inert malformed data and saved-set migration; actual bootstrap preview and live mobile screenshots; preserve concurrent site releases and all draft/progress behavior.
