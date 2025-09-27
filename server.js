const express = require('express');
const cors = require('cors');
require('dotenv').config(); // Load environment variables from .env
const { GoogleGenAI } = require('@google/genai');

const app = express();
const PORT = 3001; // The port the server will run on

// Load API Key securely from .env
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY || GEMINI_API_KEY === "YOUR_GEMINI_API_KEY_HERE") {
    console.error("FATAL ERROR: GEMINI_API_KEY not set correctly in .env file.");
    // Exit if the key is missing or is the placeholder value
    process.exit(1); 
}

// Initialize the Google GenAI client
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
const model = "gemini-2.5-flash"; // A fast and capable model for chat

// Middleware
app.use(cors()); // Allows your frontend (running on Live Server, e.g., port 5500) to talk to this backend
app.use(express.json()); // To parse incoming JSON payloads from the frontend

// --- RAG CONTEXT ---
// This context is derived directly from your Sayonara project presentation slides.
// It acts as the Retrieval step in RAG, grounding the LLM's answers.
const PROJECT_CONTEXT = `
You are an expert AI assistant for "Project Sayonara," a secure data wiping solution presented for SIH 2025. 
Your responses must be based *only* on the provided context below. Do not use external knowledge. 
If the answer is not available in the context, state clearly, "I am unable to find that specific detail in the project documentation."

--- PROJECT SAYONARA CONTEXT ---

**Slide 2 - Idea / Solution / Problem Resolution / UVP**
* **Problem:** No proof of erasure (buyers & auditors don’t trust); Wipes are complex & error-prone (risk of bricking); Wrong methods leave recoverable data (esp. SSD/NVMe); Too many fragmented tools; “Did it really wipe?” doubt remains; SMEs struggle to show CSR/environmental responsibility; Resale often undervalued due to lack of proof.
* **Function:** Wipe Engine = f(Device, Storage, Policy); Auto-selects the right sanitization method (HDD/SSD/NVMe/Android); Combines secure erase + recovery validation + health scan; Produces signed certificate + dashboard view.
* **Solution:** Tamper-proof proof (Blockchain-anchored certificates + real-time logs); Correct erasure (Dual-phase sanitization: crypto-erase + firmware sanitize); Proof loop (Built-in forensic recovery test, auto re-wipe if needed); Unified tool (Works across Windows, Linux, Android, HDD/SSD/NVMe, via USB/App); Resale & CSR (Health-based resale valuation, SME dashboard for ESG metrics).
* **UVPs (Unique Value Propositions):** Tamper-proof trust (blockchain certificates + signed logs); Media-correct sanitization (device-aware erasure engine); Proof loop (recovery validation post-wipe); Simple UX (guided steps + one-click mode + AI assistance); CSR advantage for SMEs (dashboard showing CO₂ saved, landfill reduction, devices recycled); Resale value protection (AI estimator tied to health data).

**Slide 3 - Technical Approach**
* **Content Technologies Used:** Core Engine: Rust, Alpine Linux ISO/USB, Axum. Frontends: React (UI), Tauri (Windows/Linux), React Native (Android), Next.js + Supabase (Dashboards). Blockchain: Ethereum Sepolia, Solidity, Ethers.js, Anchoring Gateway. AI: Gemini + LangChain (context-aware operator chatbot). Security: HSM/Vault, TLS 1.3, JSON/PDF certs with QR. Monitoring: Prometheus + Grafana, ELK/OpenSearch logs.
* **Methodology / Process:** Intake → Erasure (crypto-erase + sanitize) → Recovery validation → Health check → Certificate generation → Anchoring → Dashboards. Works in both offline-first mode (USB, air-gapped) and partial online mode (cloud anchoring + SME CSR dashboard).

**Slide 4 - Feasibility & Viability**
* **Feasibility (Technical):** Uses industry-standard methods (NIST 800-88, IEEE 2883). Core engine in Rust ensures safety & performance. Operational: Works offline (suitable for air-gapped enterprises). USB boot ISO ensures OS-independent wipes. Market: Growing e-waste regulations (India DPDP Act, GDPR, WEEE Directive) → strong demand.
* **Potential Challenges:** Hardware diversity (SSD vendor lock-ins), Android bootloader restrictions, User adoption (SMEs may resist adopting new workflows), Blockchain reliance (needs fallback for offline mode).
* **Strategies:** Vendor tool integration (NVMe CLI, PSID Revert, Android FBE key shred). AI guidance & one-click UX to reduce adoption friction. Offline-first design (certificates signed locally, blockchain anchoring deferred). CSR dashboard as a motivator (aligns with SME compliance & ESG goals).

**Slide 5 - Impact & Benefits**
* **Potential Impact (Users):** Peace of mind that data is irrecoverably erased. SMEs: CSR dashboard quantifies recycling & ESG impact. Auditors: tamper-proof blockchain-anchored proof of compliance. Environment: e-waste reduced, CO₂ and landfill waste minimized.
* **Benefits (Social):** Builds digital trust, educates users about real erasure. Economic: Resale value protection, SMEs gain stronger negotiating power. Environmental: Measurable ESG impact (X devices recycled, Y kg CO₂ saved).

--- END CONTEXT ---
`;

// Main chat endpoint
app.post('/api/chat', async (req, res) => {
    
        // The chat history (messages array) is passed from the frontend
        const { chatHistory } = req.body;

    // ADD THIS CHECK:
    if (!chatHistory || chatHistory.length === 0) {
        return res.status(400).json({ error: 'contents are required' });
    }

        
        // Use the ai.models.generateContent method
       try{ const response = await ai.models.generateContent({
            model: model,
            contents: chatHistory, // Pass the conversation history for context awareness
            config: {
                // Pass the system instruction text containing the RAG context
                systemInstruction: PROJECT_CONTEXT, 
            },
        });

        // Send the response text back to the frontend
        const text = response.text || "I was unable to generate a response.";
        res.json({ text });

    } catch (error) {
        console.error('Gemini API Error:', error);
        res.status(500).json({ error: 'Failed to communicate with the Gemini API.' });
    }
});


app.listen(PORT, () => {
    console.log(`\n✅ Backend Server running at http://localhost:${PORT}/`);
    console.log(`   (Remember to open index.html using Live Server)`);
});
