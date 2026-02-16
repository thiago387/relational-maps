import { useState, useCallback, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, X } from 'lucide-react';
import type { Email } from '@/types/graph';

interface GraphSearchOverlayProps {
  emails: Email[];
  onHighlight: (nodeIds: Set<string> | null) => void;
}

export function GraphSearchOverlay({ emails, onHighlight }: GraphSearchOverlayProps) {
  const [query, setQuery] = useState('');
  const [matchCount, setMatchCount] = useState(0);

  const doSearch = useCallback((q: string) => {
    if (q.length < 3) {
      onHighlight(null);
      setMatchCount(0);
      return;
    }

    const lower = q.toLowerCase();
    const matchingPersonIds = new Set<string>();

    emails.forEach(email => {
      const subjectMatch = email.subject?.toLowerCase().includes(lower);
      const bodyMatch = email.body?.toLowerCase().includes(lower) || email.message_clean?.toLowerCase().includes(lower);

      if (subjectMatch || bodyMatch) {
        if (email.sender_id) matchingPersonIds.add(email.sender_id);
        if (email.recipient) matchingPersonIds.add(email.recipient);
      }
    });

    setMatchCount(matchingPersonIds.size);
    onHighlight(matchingPersonIds.size > 0 ? matchingPersonIds : null);
  }, [emails, onHighlight]);

  useEffect(() => {
    doSearch(query);
  }, [query, doSearch]);

  const handleClear = () => {
    setQuery('');
    onHighlight(null);
    setMatchCount(0);
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClear();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="Search emails..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-8 pr-8 h-8 w-56 text-xs bg-background/90 backdrop-blur shadow-md border-border"
        />
        {query && (
          <button onClick={handleClear} className="absolute right-2 top-1/2 -translate-y-1/2">
            <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
          </button>
        )}
      </div>
      {query.length >= 3 && (
        <Badge variant="secondary" className="text-[10px] shadow-md bg-background/90 backdrop-blur">
          {matchCount} nodes
        </Badge>
      )}
    </div>
  );
}
