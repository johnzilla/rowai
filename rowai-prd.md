Product Requirements Document (PRD)
RowAI – Adaptive AI Rowing Coach Avatar
Version 1.0 | Date: April 2026
Owner: [Your Name]  1. Vision & Problem StatementVision
RowAI is a warm, intelligent AI avatar coach that turns solo indoor rowing into a personalized, motivating experience. The avatar (with customizable female voice as the primary option) rows “with you” in beautiful virtual scenery, deeply understands your workout history, energy patterns, and encouragement preferences, and adapts sessions in real time — especially for older adults, work-from-home users, or anyone seeking gentle, consistent low-impact fitness.Problem
Current indoor rowing solutions offer pretty scenery or canned workouts, but lack a persistent, relationship-building coach that truly knows the user. Generic apps feel impersonal; users often lose motivation or quit due to boredom, lack of tailored encouragement, or uncertainty about what to do on any given day. Existing AI coaching (e.g., Ergatta Coach AI for form) is strong on technique but weak on emotional intelligence, long-term memory, and voice-based companionship.Opportunity
Build the “caring personal coach who actually gets me” for Concept2 users and beyond. Start with rowing, then expand to recumbent bikes (e.g., NordicTrack) and other gentle home activities.2. Target Users & PersonasPrimary: Older or “frail” adults (50+) who row at home for health/longevity, work from home full-time, value low-impact consistent movement, and respond best to calm, supportive female voices.
Secondary: Anyone wanting sustainable home rowing/cycling without high-pressure coaching; beginners recovering from injury; busy professionals needing quick desk-break sessions.
Key needs: Gentle adaptation, minimal friction, voice-first interaction, privacy-focused data handling.

3. Core Value PropositionRowAI turns your Concept2 rower (or compatible bike) into a training session with a trusted companion who:Remembers your full history and personal patterns.
Delivers the exact encouragement tone/voice you like (e.g., calm supportive female mentor).
Adapts workouts live based on real-time metrics and daily context.
Makes rowing feel relational and enjoyable rather than solitary.

4. Key Features (MVP Scope)Phase 1 MVP – Voice-First Adaptive Coach (Focus: Low Latency, Concept2 Integration)Real-time data ingestion from Concept2 PM5 via Bluetooth (stroke rate, split, power, distance, HR if available).
Persistent user memory: Vector DB stores workout history, user feedback ratings, and patterns (e.g., “fades in last 500m”, “responds best to quiet confidence”).
Customizable female voice avatar with emotional range (supportive, firm-but-kind, light humor). Use Cartesia Sonic (or equivalent) for ultra-low latency streaming TTS (~40–90ms TTFA).
On-the-fly workout adaptation: Adjust interval length, intensity, or focus based on live metrics and history.
Voice-first interaction: User can speak mid-row (“Coach, I’m tired today”) → natural response and adjustment.
Gentle form feedback via optional phone/tablet camera (on-device MediaPipe Pose for low latency; no raw video sent to cloud).
Beautiful reactive scenery (virtual rivers/lakes) with avatar “in the boat” — lip-sync and expressions driven by TTS.
Post-session debrief: Short, encouraging summary with progress notes.
Full sync with Concept2 Logbook API (read history + write completed workouts).

Nice-to-Haves for v1.1Voice cloning from short user sample.
Multi-device support (phone as data source + tablet/TV for avatar view via AirPlay/mirroring).
Integration layer for NordicTrack/iFIT (pull resistance/cadence data, overlay avatar on existing screen).
Basic recovery-day detection and gentle suggestions.

Non-Goals for MVPFull multiplayer races.
Advanced gamification.
Video streaming of avatar (prefer client-side rendering or lightweight WebRTC).
Onboard nutrition or sleep coaching.

5. User Flows (High-Level)Pre-sessionOpen RowAI app → quick voice check-in (“How are you feeling today?”) → AI suggests or lets user choose session type.

During session (Concept2 example)Phone pairs via Bluetooth to PM5 (parallel with ErgData if desired).
RowAI displays scenery + avatar on phone or cast to tablet/TV.
Avatar coaches in real time with preferred voice/tone.
User can speak commands; form cues appear gently if camera enabled.

Post-sessionAuto-upload to Concept2 Logbook.
30-second voice or text debrief.
User rates encouragement style (thumbs up/down) to refine future behavior.

6. Technical Requirements & ArchitectureIntegrationConcept2 PM5: Bluetooth GATT for real-time data + Logbook API (OAuth + API key) for read/write. Proven by multiple apps (Ergatta, ErgZone, etc.) — multiple apps can read simultaneously on iOS.
iOS-first client (React Native or SwiftUI) with optional Android/web support later.

Stack (Digital Ocean preferred)Client: React Native/Flutter + Unity/Three.js for avatar (local rendering where possible).
Real-time: WebSockets for stroke data; streaming TTS via Cartesia Sonic.
Backend: FastAPI on DO App Platform or DOKS (Kubernetes).
AI Brain: Fine-tuned smaller LLMs (Llama/Mistral) on GPU Droplets for coaching decisions + vector DB (Weaviate/Supabase) for memory/RAG.
Latency focus: On-device vision; streaming responses; target <500–700ms end-to-end for cues.
Privacy: Raw camera on-device only; anonymized pose data if needed; HIPAA/GDPR ready.

Success MetricsUser retention: % completing 3+ sessions/week after 30 days.
Satisfaction: Average session rating + encouragement thumbs-up rate.
Technical: p95 latency for voice cues <800ms; successful Logbook sync rate >98%.

7. Risks & DependenciesBluetooth conflicts on iOS: Mitigate with listener mode + user choice of primary app.
Inference cost/latency on DO GPUs: Start with caching common phrases and smaller models.
Voice naturalness: Test multiple TTS providers early (Cartesia primary for speed).
Concept2 API approval: Use dev environment first, then request live access.

8. Roadmap OutlineMVP (3–6 months): Voice-first rowing coach for Concept2 on iOS, with memory and one strong female voice option.
v1.1: Camera form feedback + tablet casting.
v2: NordicTrack bike integration + avatar visual polish + voice cloning.
Future: Expand to other low-impact activities; multi-avatar crew mode.

