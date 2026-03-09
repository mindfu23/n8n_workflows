#!/usr/bin/env node
/**
 * Local test: simulates the "Prepare Consistency Check" Code node
 * using realistic data matching what "Combine Draft & Suggestions" outputs.
 *
 * Run: node test-chatgpt-body.js
 */

// Simulate $json from "Combine Draft & Suggestions" output
// (based on the input data visible in the n8n screenshots)
const $json = {
  "Project ID": "20260309-014807",
  "Project Slug": "miskatonic-boys",
  "Concept": `Lovecraftian horror meets indie rock meets Scott Pilgrim. At Miskatonic University, two student musicians -- Margin Hawthorne (guitarist/engineer) and Korwen Llewelyn (vocalist/keyboardist) -- form a duo called the Miskatonic Boys. They discover the Dean has a deal with dark forces to recruit and sacrifice bands, manipulating culture through music. With help from a secret rebel group called the Dreamtenders, they use ancient chants and powerful frequencies in their music to fight back against the occult conspiracy.`,
  "Genre": "Lovecraftian horror comedy",
  "Status": "planning_complete",
  "Target Chapters": 1,
  "Created At": "2026-03-09T01:48:07.333-04:00",
  "Planning Data": JSON.stringify({
    plotOutline: {
      acts: [
        { act: 1, description: "Introduction and initial crossing into the unknown world of Miskatonic University's mysteries." },
        { act: 2, description: "Deepening involvement in the occult conspiracy and the struggle to adapt to new realities." },
        { act: 3, description: "Climactic confrontation and resolution, leading to transformation and a new equilibrium." }
      ],
      plotPoints: [
        "Margin and Korwen form the Miskatonic Boys and stumble upon the Midnight Society, marking them as targets.",
        "The duo grapples with the reality of an occult conspiracy while trying to maintain their normal lives.",
        "With the help of the Dreamtenders, they plan to use their music against the dark forces at play.",
        "A major concert becomes the setting for a life-or-death battle against the occult."
      ]
    }
  }),
  // This is what "Combine Draft & Suggestions" adds
  currentChapterDraft: {
    chapterNumber: 1,
    text: `The fluorescent lights of Arkham's lone Guitar Center buzzed like trapped wasps as Margin Hawthorne hunched over a secondhand Fender Jazzmaster, coaxing dissonant chords through a cranked Orange amp. The feedback howled—beautiful, monstrous—and somewhere behind the drum kit display, a sales associate winced.

"Dude," said Korwen Llewelyn, materializing from the bass guitar aisle like a specter in a vintage Pixies t-shirt, "you're literally making that guy's ears bleed."

Margin didn't look up. Her fingers walked a chromatic descent that would have made Robert Fripp weep—or possibly file a restraining order. "Good. Music should hurt a little."

"Tell that to our future audience." Korwen slid onto a display amp, long legs folding like a carpenter's rule. His platinum-dyed hair caught the fluorescent light, making him look like an anime character who'd wandered into the wrong dimension. "Assuming we ever get one."

This was the fundamental tension of their partnership, now entering its third glorious week. Margin heard music as architecture—cathedral-sized structures of interlocking frequencies, mathematical and inevitable. Korwen heard it as conversation—messy, emotional, riddled with non sequiturs and sudden revelations.`,
    wordCount: 178,
    creativeSuggestions: [],
    draftedAt: "2026-03-09T02:15:00.000Z"
  }
};

// === This is the Code node logic ("Prepare Consistency Check") ===
const draft = $json.currentChapterDraft || {};
const chapterNum = draft.chapterNumber || 1;
const chapterText = (draft.text || '').substring(0, 8000);
const planningData = ($json['Planning Data'] || 'No outline available').substring(0, 2000);

const requestBody = {
  model: 'gpt-4o',
  messages: [
    {
      role: 'system',
      content: 'You are a continuity editor checking for plot consistency and logical coherence.'
    },
    {
      role: 'user',
      content: `Check this chapter for consistency issues:\n\nChapter ${chapterNum}:\n${chapterText}\n\nPlot Outline Context:\n${planningData}\n\nIdentify:\n1. Timeline inconsistencies\n2. Character behavior contradictions\n3. Setting/world-building errors\n4. Plot holes or logic gaps\n5. Dropped threads or forgotten elements\n\nFormat as JSON with keys: issues (array of objects with type, description, severity, suggestedFix), consistencyScore (1-10)`
    }
  ],
  temperature: 0.2,
  max_tokens: 2000
};

// === Test: does JSON.stringify produce valid JSON? ===
try {
  const jsonString = JSON.stringify(requestBody);

  // Verify it's valid by parsing it back
  const parsed = JSON.parse(jsonString);

  console.log('✅ JSON is VALID');
  console.log(`   Model: ${parsed.model}`);
  console.log(`   Messages: ${parsed.messages.length}`);
  console.log(`   System prompt length: ${parsed.messages[0].content.length} chars`);
  console.log(`   User prompt length: ${parsed.messages[1].content.length} chars`);
  console.log(`   Total JSON length: ${jsonString.length} chars`);
  console.log('\n--- First 500 chars of JSON string ---');
  console.log(jsonString.substring(0, 500));
  console.log('...');

  // Also test what the HTTP Request node expression would produce
  console.log('\n--- Testing ={{ JSON.stringify($json.requestBody) }} equivalent ---');
  const simulatedOutput = { ...$json, requestBody };
  const httpBodyResult = JSON.stringify(simulatedOutput.requestBody);
  const reparsed = JSON.parse(httpBodyResult);
  console.log('✅ HTTP Request body expression also produces valid JSON');

} catch (e) {
  console.log('❌ JSON is INVALID:', e.message);
  console.log('   This would cause the n8n error.');
}
