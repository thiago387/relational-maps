import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import { 
  Upload, 
  Link, 
  Play, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  FileText,
  Download,
  Trash2,
  RefreshCw
} from 'lucide-react';
import type { Email } from '@/types/graph';

interface ImportPanelProps {
  onScrape: (url: string, action: string) => Promise<any>;
  onImport: (emails: Partial<Email>[]) => Promise<any>;
  onAnalyze: (batchSize?: number) => Promise<any>;
  onCompute: () => Promise<any>;
  onClear: () => Promise<any>;
  onRefresh: () => void;
  isScraping: boolean;
  isImporting: boolean;
  isAnalyzing: boolean;
  isComputing: boolean;
  isClearing: boolean;
  stats: {
    emailCount: number;
    analyzedCount: number;
    personCount: number;
    relationshipCount: number;
  } | undefined;
}

// Sample demo data for testing
const DEMO_EMAILS: Partial<Email>[] = [
  {
    message_id: 'demo-1',
    from_email: 'jeffrey.epstein@example.com',
    from_name: 'Jeffrey Epstein',
    to_emails: ['ghislaine.maxwell@example.com'],
    subject: 'Meeting tomorrow',
    body: 'We need to discuss the upcoming arrangements. Please confirm your attendance.',
    date: '2015-03-15T10:30:00Z',
  },
  {
    message_id: 'demo-2',
    from_email: 'ghislaine.maxwell@example.com',
    from_name: 'Ghislaine Maxwell',
    to_emails: ['jeffrey.epstein@example.com'],
    subject: 'Re: Meeting tomorrow',
    body: 'Confirmed. I will be there at 2pm. Looking forward to it.',
    date: '2015-03-15T14:22:00Z',
  },
  {
    message_id: 'demo-3',
    from_email: 'jeffrey.epstein@example.com',
    from_name: 'Jeffrey Epstein',
    to_emails: ['assistant@example.com', 'ghislaine.maxwell@example.com'],
    subject: 'Travel arrangements',
    body: 'Please book the private jet for next week. Need to be in New York by Thursday.',
    date: '2015-03-20T09:15:00Z',
  },
  {
    message_id: 'demo-4',
    from_email: 'assistant@example.com',
    from_name: 'Personal Assistant',
    to_emails: ['jeffrey.epstein@example.com'],
    subject: 'Re: Travel arrangements',
    body: 'Done. Flight scheduled for Wednesday evening. Hotel booked at the usual place.',
    date: '2015-03-20T11:45:00Z',
  },
  {
    message_id: 'demo-5',
    from_email: 'lawyer@lawfirm.com',
    from_name: 'Legal Counsel',
    to_emails: ['jeffrey.epstein@example.com'],
    subject: 'Urgent: Legal matters',
    body: 'We need to discuss some pressing legal issues. This is urgent and requires immediate attention.',
    date: '2015-04-02T16:30:00Z',
  },
  {
    message_id: 'demo-6',
    from_email: 'jeffrey.epstein@example.com',
    from_name: 'Jeffrey Epstein',
    to_emails: ['lawyer@lawfirm.com'],
    cc_emails: ['ghislaine.maxwell@example.com'],
    subject: 'Re: Urgent: Legal matters',
    body: 'I am very concerned about this. We need to handle this carefully and discretely.',
    date: '2015-04-02T18:00:00Z',
  },
  {
    message_id: 'demo-7',
    from_email: 'finance@company.com',
    from_name: 'Finance Manager',
    to_emails: ['jeffrey.epstein@example.com'],
    subject: 'Quarterly report',
    body: 'Attached is the quarterly financial report. Everything looks positive this quarter.',
    date: '2015-04-10T09:00:00Z',
  },
  {
    message_id: 'demo-8',
    from_email: 'ghislaine.maxwell@example.com',
    from_name: 'Ghislaine Maxwell',
    to_emails: ['assistant@example.com'],
    subject: 'Event planning',
    body: 'Need to organize the dinner party for next month. Please send me the guest list.',
    date: '2015-04-15T13:20:00Z',
  },
  {
    message_id: 'demo-9',
    from_email: 'assistant@example.com',
    from_name: 'Personal Assistant',
    to_emails: ['ghislaine.maxwell@example.com'],
    subject: 'Re: Event planning',
    body: 'Guest list attached. Do you want me to send out the invitations?',
    date: '2015-04-15T15:45:00Z',
  },
  {
    message_id: 'demo-10',
    from_email: 'jeffrey.epstein@example.com',
    from_name: 'Jeffrey Epstein',
    to_emails: ['finance@company.com'],
    subject: 'Investment opportunity',
    body: 'I want to explore a new investment. Please prepare an analysis by end of week.',
    date: '2015-04-20T10:00:00Z',
  },
];

export function ImportPanel({
  onScrape,
  onImport,
  onAnalyze,
  onCompute,
  onClear,
  onRefresh,
  isScraping,
  isImporting,
  isAnalyzing,
  isComputing,
  isClearing,
  stats,
}: ImportPanelProps) {
  const { toast } = useToast();
  const [sourceUrl, setSourceUrl] = useState('https://github.com/the-atlantic/epstein-emails');
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [isRunningPipeline, setIsRunningPipeline] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLoadDemo = async () => {
    try {
      await onImport(DEMO_EMAILS);
      toast({
        title: 'Demo data loaded',
        description: `${DEMO_EMAILS.length} sample emails imported successfully`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load demo data',
        variant: 'destructive',
      });
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      let emails: Partial<Email>[] = [];

      if (file.name.endsWith('.json')) {
        const data = JSON.parse(text);
        emails = Array.isArray(data) ? data : [data];
      } else if (file.name.endsWith('.csv')) {
        // Simple CSV parsing
        const lines = text.split('\n');
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        
        emails = lines.slice(1).filter(line => line.trim()).map(line => {
          const values = line.split(',');
          const email: Partial<Email> = {};
          
          headers.forEach((header, i) => {
            const value = values[i]?.trim();
            if (header === 'from' || header === 'from_email') email.from_email = value;
            if (header === 'to' || header === 'to_emails') email.to_emails = [value];
            if (header === 'subject') email.subject = value;
            if (header === 'body' || header === 'content') email.body = value;
            if (header === 'date') email.date = value;
          });
          
          return email;
        }).filter(e => e.from_email);
      }

      if (emails.length > 0) {
        await onImport(emails);
        toast({
          title: 'Import successful',
          description: `${emails.length} emails imported`,
        });
      } else {
        toast({
          title: 'No emails found',
          description: 'Could not parse any emails from the file',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Import failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRunAnalysis = async () => {
    if (!stats || stats.emailCount === 0) {
      toast({
        title: 'No emails to analyze',
        description: 'Import emails first before running analysis',
        variant: 'destructive',
      });
      return;
    }

    setIsRunningPipeline(true);
    setAnalysisProgress(0);

    try {
      // Run sentiment analysis in batches
      let remaining = stats.emailCount - stats.analyzedCount;
      let processed = stats.analyzedCount;

      while (remaining > 0) {
        const result = await onAnalyze(10);
        
        if (!result.success) {
          if (result.error?.includes('Rate limit')) {
            toast({
              title: 'Rate limited',
              description: 'Waiting before continuing...',
            });
            await new Promise(resolve => setTimeout(resolve, 5000));
            continue;
          }
          throw new Error(result.error || 'Analysis failed');
        }

        processed += result.processed || 0;
        remaining = result.remaining || 0;
        
        setAnalysisProgress(Math.round((processed / stats.emailCount) * 100));

        // Small delay between batches
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      toast({
        title: 'Analysis complete',
        description: 'Now computing graph relationships...',
      });

      // Compute graph
      await onCompute();

      toast({
        title: 'Pipeline complete',
        description: 'Graph is ready to explore!',
      });

      onRefresh();
    } catch (error) {
      toast({
        title: 'Analysis error',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsRunningPipeline(false);
      setAnalysisProgress(0);
    }
  };

  const handleClearData = async () => {
    if (!confirm('Are you sure you want to delete all data? This cannot be undone.')) return;

    try {
      await onClear();
      toast({
        title: 'Data cleared',
        description: 'All emails and analysis data has been deleted',
      });
      onRefresh();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to clear data',
        variant: 'destructive',
      });
    }
  };

  const isProcessing = isScraping || isImporting || isAnalyzing || isComputing || isClearing || isRunningPipeline;

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Data Import & Analysis</h3>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={onRefresh}
          disabled={isProcessing}
        >
          <RefreshCw className={`h-4 w-4 ${isProcessing ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      <Tabs defaultValue="demo" className="w-full">
        <TabsList className="w-full">
          <TabsTrigger value="demo" className="flex-1">Demo</TabsTrigger>
          <TabsTrigger value="file" className="flex-1">File</TabsTrigger>
          <TabsTrigger value="url" className="flex-1">URL</TabsTrigger>
        </TabsList>

        <TabsContent value="demo" className="mt-4 space-y-3">
          <p className="text-sm text-muted-foreground">
            Load sample email data to test the visualization without importing real data.
          </p>
          <Button 
            onClick={handleLoadDemo} 
            disabled={isProcessing}
            className="w-full"
          >
            {isImporting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            Load Demo Data ({DEMO_EMAILS.length} emails)
          </Button>
        </TabsContent>

        <TabsContent value="file" className="mt-4 space-y-3">
          <p className="text-sm text-muted-foreground">
            Upload a JSON or CSV file containing email data.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,.csv"
            onChange={handleFileUpload}
            className="hidden"
          />
          <Button 
            onClick={() => fileInputRef.current?.click()} 
            disabled={isProcessing}
            variant="outline"
            className="w-full"
          >
            <Upload className="h-4 w-4 mr-2" />
            Upload File
          </Button>
        </TabsContent>

        <TabsContent value="url" className="mt-4 space-y-3">
          <p className="text-sm text-muted-foreground">
            Scrape email data from a public URL using Firecrawl.
          </p>
          <Input
            placeholder="Enter source URL..."
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            disabled={isProcessing}
          />
          <Button 
            onClick={() => onScrape(sourceUrl, 'discover')} 
            disabled={isProcessing || !sourceUrl}
            variant="outline"
            className="w-full"
          >
            {isScraping ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Link className="h-4 w-4 mr-2" />
            )}
            Discover Data
          </Button>
        </TabsContent>
      </Tabs>

      {/* Analysis section */}
      {stats && stats.emailCount > 0 && (
        <div className="space-y-3 pt-3 border-t border-border">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Analysis Progress</span>
            <span className="font-medium">
              {stats.analyzedCount} / {stats.emailCount} emails
            </span>
          </div>
          
          <Progress 
            value={isRunningPipeline ? analysisProgress : (stats.analyzedCount / stats.emailCount) * 100} 
          />

          <Button
            onClick={handleRunAnalysis}
            disabled={isProcessing || stats.analyzedCount === stats.emailCount}
            className="w-full"
          >
            {isRunningPipeline ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Analyzing... {analysisProgress}%
              </>
            ) : stats.analyzedCount === stats.emailCount ? (
              <>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Analysis Complete
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Run Analysis Pipeline
              </>
            )}
          </Button>

          {stats.analyzedCount === stats.emailCount && stats.relationshipCount === 0 && (
            <Button
              onClick={onCompute}
              disabled={isProcessing}
              variant="secondary"
              className="w-full"
            >
              {isComputing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Compute Graph
            </Button>
          )}
        </div>
      )}

      {/* Clear data */}
      {stats && stats.emailCount > 0 && (
        <Button
          onClick={handleClearData}
          disabled={isProcessing}
          variant="destructive"
          size="sm"
          className="w-full"
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Clear All Data
        </Button>
      )}
    </Card>
  );
}
