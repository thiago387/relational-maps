import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Normalize person IDs to merge duplicates like "AlexFamilyPines" and "Alex.FamilyPines"
export function normalizePersonId(id: string): string {
  return id
    .replace(/\./g, '')           // Remove dots
    .replace(/^(Ms|Mr|Mrs|Dr)\.?/i, '') // Remove common prefixes
    .trim();
}

// Get canonical ID mapping for deduplication
export function buildIdNormalizationMap(ids: string[]): Map<string, string> {
  const normalizedToCanonical = new Map<string, string>();
  const idToNormalized = new Map<string, string>();
  
  ids.forEach(id => {
    const normalized = normalizePersonId(id);
    idToNormalized.set(id, normalized);
    
    // Keep the shortest original ID as canonical
    if (!normalizedToCanonical.has(normalized) || 
        id.length < normalizedToCanonical.get(normalized)!.length) {
      normalizedToCanonical.set(normalized, id);
    }
  });
  
  // Return map from any ID to its canonical form
  const result = new Map<string, string>();
  ids.forEach(id => {
    const normalized = idToNormalized.get(id)!;
    const canonical = normalizedToCanonical.get(normalized)!;
    result.set(id, canonical);
  });
  
  return result;
}
