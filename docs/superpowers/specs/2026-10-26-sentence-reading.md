# Sentence-aligned reading repair

The reader currently renders a complete English paragraph followed by a complete Chinese paragraph. Existing Book2 Chinese often combines English sentences, and dialogue is embedded inside narrative paragraphs. This makes source/translation and speaker correspondence unclear on phones.

Repair the existing reading flow without changing textbook English, course IDs, quiz sources, audio files or learner records. Book2 all96 lessons receive reviewed sentence-unit translations with explicit narrator/speaker/thought/note metadata. Keep short attribution clauses attached to their quote. Retain paragraphs as source metadata while splitting long narrative display groups. Render each English unit directly above its own Chinese unit; speaker changes start separate labelled blocks. The translation checkbox hides Chinese only. Word buttons remain available.

Use a shared source-preserving splitter for reading and TTS indexes. Guard each alignment by exact course identity, paragraph index, source units and complete Chinese coverage. Never zip independently split Chinese to English. When an imported or untranslated passage has no checked alignment, retain source paragraphs, split English for readability and label any full-paragraph Chinese separately. Do not claim speaker identity when it is unconfirmed.

Approach: explicit bilingual data was chosen because punctuation/count-based automatic pairing can assign the wrong meaning after existing merged translations. The existing static hosting remains sufficient; no API or server is introduced. Authored Chinese is labelled non-official.
