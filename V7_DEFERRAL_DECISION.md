# V7 Deferral Decision

**Date:** November 5, 2025
**Decision:** Defer v7 AI layer in favor of v6 improvements

## Why Defer V7?

### The Core Issue
V7 was designed to use AI to pre-process, score, and compress context. However, this solves a problem that **MCP's architecture already handles better** through lazy loading.

### Specific Problems with V7

1. **Auto-Extraction is Redundant**
   - Git already tracks changes
   - Commit messages are already concise
   - No need to "extract" what's already structured

2. **Relevance Scoring is Unnecessary**
   - AI assistants query what they need via MCP tools
   - Pre-scoring everything wastes resources
   - Example: Claude asks "show auth code" → search_files("auth") → read results
   - No pre-scoring needed

3. **Context Compression Misses the Point**
   - MCP uses lazy loading (like an IDE)
   - Don't need to compress everything upfront
   - AI loads files on-demand through tool calls

4. **High Complexity, Low Benefit**
   - 3 AI provider integrations
   - 5 context engine components
   - Background daemons
   - API costs
   - Massive maintenance burden
   - **For features MCP already provides differently**

## What We're Doing Instead

### V6 Improvements (Simple, High Impact)

1. **Storage Management** (The Real Problem)
   - Project namespacing (active/archived/deleted)
   - Cleanup daemon for stale data
   - User-controlled retention policies
   - Storage dashboard and stats

2. **Cloud Backup** (Monetization)
   - Free tier: 5 projects or 100MB local
   - Premium: Unlimited cloud storage + auto-sync
   - Real user value: "Never lose context, free up disk space"
   - Service premium, not feature premium

3. **Smart Summarization** (No AI Needed)
   - Rule-based context aggregation
   - Last N conversations/commits/decisions
   - Structured summaries, not raw dumps

4. **Conversation Pruning**
   - Keep recent conversations (full)
   - Keep decisions from old conversations
   - Delete messages older than retention period

## V7 Code Preservation

All v7 work archived in branch: `archive/v7-ai-layer`

Includes:
- `src/ai/` - Provider system
- `src/context-engine/` - All components
- `CONTEXT_ENGINE_INTEGRATION_PLAN.md`
- `scripts/test-extract.ts`

Can be revived later if user demand emerges.

## The Lesson

**Engineering for engineering's sake** - We got excited about AI capabilities and tried to find a place to use them, even though the problem was already solved by MCP's design patterns.

The irony: Building an AI context tool, then adding AI to manage the AI's context management. Too meta, not enough value.

## Next Steps

1. Clean v7 code from release branch
2. Update ROADMAP.md to reflect v6 improvements
3. Ship v6.1 with storage management
4. Ship v6.5 with cloud backup (monetization)
5. Monitor user feedback for actual pain points
