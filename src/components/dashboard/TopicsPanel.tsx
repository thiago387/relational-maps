import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import type { Email } from '@/types/graph';
import { cn } from '@/lib/utils';

interface TopicsPanelProps {
  emails: Email[];
  onTopicFilter?: (topic: string | null) => void;
}

export function TopicsPanel({ emails, onTopicFilter }: TopicsPanelProps) {
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);

  const { topTopics, topMarkers } = useMemo(() => {
    const topicCounts = new Map<string, number>();
    const markerCounts = new Map<string, number>();

    emails.forEach(email => {
      if (email.topics) {
        email.topics.forEach(t => {
          if (t && t.trim()) topicCounts.set(t.trim(), (topicCounts.get(t.trim()) || 0) + 1);
        });
      }
      if (email.emotional_markers) {
        email.emotional_markers.forEach(m => {
          if (m && m.trim()) markerCounts.set(m.trim(), (markerCounts.get(m.trim()) || 0) + 1);
        });
      }
    });

    const topTopics = Array.from(topicCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15);

    const topMarkers = Array.from(markerCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    return { topTopics, topMarkers };
  }, [emails]);

  const maxTopicCount = topTopics.length > 0 ? topTopics[0][1] : 1;

  const handleTopicClick = (topic: string) => {
    const next = selectedTopic === topic ? null : topic;
    setSelectedTopic(next);
    onTopicFilter?.(next);
  };

  if (topTopics.length === 0 && topMarkers.length === 0) {
    return (
      <div className="p-4 text-center text-sm text-muted-foreground">
        No topics or emotional markers found in emails
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {topTopics.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Top Topics</p>
          <div className="space-y-1">
            {topTopics.map(([topic, count]) => (
              <button
                key={topic}
                onClick={() => handleTopicClick(topic)}
                className={cn(
                  "w-full flex items-center gap-2 text-left rounded px-1.5 py-1 transition-colors text-xs",
                  selectedTopic === topic ? "bg-primary/20 ring-1 ring-primary" : "hover:bg-accent/50"
                )}
              >
                <div
                  className="h-2.5 rounded-sm bg-primary/70 flex-shrink-0"
                  style={{ width: `${(count / maxTopicCount) * 100}%`, minWidth: 4 }}
                />
                <span className="truncate flex-1">{topic}</span>
                <span className="text-muted-foreground flex-shrink-0">{count}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {topMarkers.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Emotional Markers</p>
          <div className="flex flex-wrap gap-1">
            {topMarkers.map(([marker, count]) => (
              <Badge key={marker} variant="secondary" className="text-[10px] px-1.5 py-0.5">
                {marker} ({count})
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
