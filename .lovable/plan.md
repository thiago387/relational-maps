

## Ingest Pre-Computed Topics and Keywords into the Topics Panel

### Why It's Empty Now

The current data loader (`precomputedDataLoader.ts`) parses a CSV that does not contain `topic_labels` or `extracted_keywords` columns. The database `topics` and `emotional_markers` columns exist but are never populated during import. Your new CSV (`emails_with_topics.csv`) has these two columns pre-computed for all 65,000+ emails.

---

### What Changes

#### 1. Replace the CSV data file

- Copy `emails_with_topics.csv` into `public/emails_with_polarity.csv` (replacing the old one)
- The new CSV uses semicolon (`;`) as delimiter -- the parser must be updated accordingly

#### 2. Update the data loader to ingest topics and keywords

**File: `src/lib/precomputedDataLoader.ts`**

- Change PapaParse delimiter to `";"` for email CSV parsing
- Update the `EmailRow` interface to include `extracted_keywords` and `topic_labels` fields
- Map `topic_labels` to the `topics` array column (split on `"; "` since multi-topic entries like `"Legal Counsel & Strategy; Obama & Democratic Politics"` use that separator)
- Map `extracted_keywords` to the `emotional_markers` array column (split on `"; "`)
- These get inserted into the existing DB columns -- no schema changes needed

#### 3. Add community and date filtering to TopicsPanel

**File: `src/components/dashboard/TopicsPanel.tsx`**

- Add props: `graphNodes` (for community lookup) and `filters` (for date range + selected communities)
- Before aggregating topics, filter the emails array:
  - By selected communities: map `sender_id` to `communityId` via graphNodes, skip emails not in selected communities
  - By date range: skip emails outside `filters.dateRange`
- Keep the existing bar chart UI and click-to-filter behavior intact
- Rename "Emotional Markers" section to "Keywords" since the data now contains extracted keywords rather than emotional markers

#### 4. Pass filter props from Dashboard

**File: `src/components/dashboard/Dashboard.tsx`**

- Update the `<TopicsPanel>` call to pass `graphNodes={graphData.nodes}` and `filters={filters}`

---

### Data Format Examples

From the CSV:
- `topic_labels`: `"Legal Counsel & Strategy; Obama & Democratic Politics; Media Inquiries & Press"` (multi-label, semicolon-separated within the field)
- `extracted_keywords`: `"is clinton; new york magazine; clinton; dershowitz; andrew; times; york; magazine"` (semicolon-separated)

These get split into arrays:
- `topics`: `["Legal Counsel & Strategy", "Obama & Democratic Politics", "Media Inquiries & Press"]`
- `emotional_markers`: `["is clinton", "new york magazine", "clinton", ...]`

---

### Technical Summary

| Item | Detail |
|------|--------|
| Files modified | `precomputedDataLoader.ts`, `TopicsPanel.tsx`, `Dashboard.tsx` |
| Files replaced | `public/emails_with_polarity.csv` (with new CSV containing topics) |
| New dependencies | None |
| DB schema changes | None -- `topics` and `emotional_markers` columns already exist |
| Re-import required | Yes -- users need to re-import data to populate the new columns |

### Important Note

After deploying this change, you will need to re-import the data (clear existing data and reload) so the new `topic_labels` and `extracted_keywords` columns get parsed into the database.

