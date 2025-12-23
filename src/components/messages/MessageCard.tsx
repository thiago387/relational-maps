import { Calendar, User, Mail, FileText, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Email } from "@/types/graph";

interface MessageCardProps {
  email: Email;
}

export function MessageCard({ email }: MessageCardProps) {
  const getSentimentColor = (polarity: number | null) => {
    if (polarity === null) return "text-muted-foreground";
    if (polarity < -0.1) return "text-red-500";
    if (polarity > 0.1) return "text-green-500";
    return "text-muted-foreground";
  };

  const getSentimentLabel = (polarity: number | null, category: string | null) => {
    if (category) return category;
    if (polarity === null) return "unknown";
    if (polarity < -0.1) return "negative";
    if (polarity > 0.1) return "positive";
    return "neutral";
  };

  return (
    <ScrollArea className="h-[600px] pr-4">
      <div className="space-y-4">
        {/* Subject */}
        <div>
          <h3 className="text-lg font-semibold text-foreground">
            {email.subject || "(No subject)"}
          </h3>
          {email.thread_subject && email.thread_subject !== email.subject && (
            <p className="text-sm text-muted-foreground">
              Thread: {email.thread_subject}
            </p>
          )}
        </div>

        <Separator />

        {/* Metadata */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-muted-foreground">From</p>
              <p className="font-medium text-foreground">{email.sender_id || email.from_email}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-muted-foreground">To</p>
              <p className="font-medium text-foreground">{email.recipient || email.to_emails?.join(", ") || "Unknown"}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-muted-foreground">Date</p>
              <p className="font-medium text-foreground">
                {email.date ? new Date(email.date).toLocaleString() : "Unknown"}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <TrendingUp className={`h-4 w-4 ${getSentimentColor(email.polarity)}`} />
            <div>
              <p className="text-muted-foreground">Sentiment</p>
              <div className="flex items-center gap-2">
                <Badge variant={
                  email.polarity && email.polarity < -0.1 ? "destructive" :
                  email.polarity && email.polarity > 0.1 ? "default" : "secondary"
                }>
                  {getSentimentLabel(email.polarity, email.sentiment_category)}
                </Badge>
                {email.polarity !== null && (
                  <span className="text-xs text-muted-foreground">
                    ({email.polarity.toFixed(3)})
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Source Info */}
        {(email.thread_id || email.source_file) && (
          <>
            <Separator />
            <div className="flex items-center gap-2 text-sm">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-muted-foreground">Source</p>
                <p className="font-mono text-xs text-foreground">
                  {email.source_file || email.thread_id}
                </p>
              </div>
            </div>
          </>
        )}

        <Separator />

        {/* Body */}
        <div>
          <p className="text-sm text-muted-foreground mb-2">Message Content</p>
          <div className="bg-muted/50 rounded-lg p-4">
            <pre className="whitespace-pre-wrap text-sm font-mono text-foreground leading-relaxed">
              {email.message_clean || email.body || "(No content)"}
            </pre>
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}
