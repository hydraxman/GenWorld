# Xiaoxiao2 / HD Flash word-timing workflow

## Resolve the voice, do not construct a name

When a user names `xiaoxiao2`, query the configured Speech region's authenticated `GET https://{region}.tts.speech.microsoft.com/cognitiveservices/voices/list` and filter the actual returned `ShortName`. Do not turn a nickname into an invented `zh-CN-Xiaoxiao2Neural`, or silently substitute standard Xiaoxiao.

The verified catalogue entry is `zh-CN-Xiaoxiao2:DragonHDFlashLatestNeural` (Female, zh-CN, Neural HD Flash). Treat the live catalogue as authoritative for availability; do not hard-code a universal regional support claim.

## Probe capabilities before a full batch

Synthesize one representative section containing Chinese, an acronym and English words. Save successful WAV bytes and raw word/bookmark events before applying optional timing assertions, so an unsupported event type does not discard usable paid output.

HD Flash can return real `WordBoundary` and `PunctuationBoundary` events without any `BookmarkReached` events. A standard-neural pipeline that asserts a bookmark per sentence will incorrectly fail after successful synthesis. Derive captions directly from real non-sentence word events: assert their concatenated text equals the approved source, then align manual semantic caption boundaries to whole-token starts. Leave optional sentence/bookmark lists empty rather than fabricating service events.

Use a minimal supported SSML structure and preserve acronym `say-as` where verified. Do not assume standard-neural `prosody rate`, bookmarks, or every SSML element works with HD families. Report provider-default synthesis separately from any later pitch-preserving FFmpeg `atempo` adjustment; unsupported requested rate is not an observed service rate.

## Switching an existing video's voice

Keep a fresh output directory and preserve the prior film. Freeze exact approved text, image assets, visual source and semantic subtitle text; rebuild their timing from the new voice. Compare those source hashes to ensure a voice-only revision has not silently rewritten content or layout.

If the new voice naturally speaks faster, first measure all sections. Use a modest pitch-preserving tempo adjustment and short explicit chapter-reading pauses rather than extreme slowdown or large unmotivated silence. Record pauses in the timeline, render each paced audio segment to its exact target length, and include the same offsets in every subtitle and visual cue. Verify final duration, complete decoding, per-chapter audio correlation, intelligible subtitles and the final frame before sending.

## Fixed-picture, exact-slot voice replacement

When picture and burned-in subtitles must remain unchanged, do not rebuild their timeline. Load all approved segment text and slots directly from the existing manifest, freeze source hashes, and generate in a separate directory. Never inherit a standard-voice script's automatic SHORT/rewrite fallback. Probe the actual requested HD voice with minimal SSML, then retain every paid raw WAV and request metadata before fitting. Use measured pitch-preserving atempo with an explicit user-approved cap; stop and report any over-cap segment rather than truncating speech. Verify all original text against submitted SSML, sample-exact 48 kHz PCM placement, each segment's unoccupied tail, and full strict decoding. Replace audio with `-c:v copy`; verify equal compressed video stream hashes, frame count and duration, plus whole-track and per-slot correlation of decoded final audio against the new WAV. Text/SSML equality is not an ASR or human-listening assessment; label that evidence boundary.

## Investigating a reported wrong voice

Decode both old and alleged replacement MP4 audio to the same PCM format and compare each against its own master and the other master, globally and per original slot. Hash-check raw WAVs against synthesis receipts and parse actual SSML text/voice IDs; do not treat a filename or catalogue gender alone as proof of the embedded track. Sample/track correlation can establish which master was muxed, but cannot establish a real person's gender or guarantee perceived feminine timbre. Keep provider `Female`, waveform-lineage verification, ASR, human listening and remote-attachment integrity as separate evidence fields; never infer gender from F0 or assume the user heard incorrectly. A fresh generation must preserve all original text/slots, use a new directory, retain paid raw responses, and avoid silently falling back to standard Xiaoxiao. HTTP audio does not embed a cryptographically attested voice identity; label request provenance and perception boundaries honestly.

References:
- https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support
- https://learn.microsoft.com/en-us/azure/ai-services/speech-service/high-definition-voices
