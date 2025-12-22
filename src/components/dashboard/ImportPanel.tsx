import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/components/ui/use-toast';
import { 
  Play, 
  Loader2, 
  Trash2,
  RefreshCw,
  Database,
  Zap
} from 'lucide-react';
import type { Email } from '@/types/graph';
import { parseEmailCSV, type CSVParseProgress } from '@/lib/csvParser';

interface ImportPanelProps {
  onImport: (emails: Partial<Email>[]) => Promise<any>;
  onAnalyze: (params: { batchSize?: number; jobId?: string }) => Promise<any>;
  onCompute: () => Promise<any>;
  onClear: () => Promise<any>;
  onRefresh: () => void;
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

export function ImportPanel({
  onImport,
  onAnalyze,
  onCompute,
  onClear,
  onRefresh,
  isImporting,
  isAnalyzing,
  isComputing,
  isClearing,
  stats,
}: ImportPanelProps) {
  const { toast } = useToast();
  const [isLoadingCSV, setIsLoadingCSV] = useState(false);
  const [csvProgress, setCsvProgress] = useState<CSVParseProgress | null>(null);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [isRunningPipeline, setIsRunningPipeline] = useState(false);

  const handleLoadCSV = async () => {
    setIsLoadingCSV(true);
    setCsvProgress({ phase: 'fetching', current: 0, total: 0, emailsFound: 0 });
    
    try {
      toast({
        title: 'Loading dataset...',
        description: 'Parsing CSV file...',
      });
      
      const emails = await parseEmailCSV((progress) => {
        setCsvProgress(progress);
      });
      
      if (emails.length === 0) {
        throw new Error('No valid emails found in CSV');
      }
      
      toast({
        title: 'Importing emails...',
        description: `Found ${emails.length} emails, inserting into database...`,
      });
      
      // Import in batches to avoid timeout
      const batchSize = 100;
      let imported = 0;
      
      for (let i = 0; i < emails.length; i += batchSize) {
        const batch = emails.slice(i, i + batchSize);
        await onImport(batch);
        imported += batch.length;
        
        setCsvProgress({
          phase: 'parsing',
          current: imported,
          total: emails.length,
          emailsFound: imported,
        });
      }
      
      toast({
        title: 'Dataset loaded successfully!',
        description: `Imported ${emails.length} emails from CSV`,
      });
      
      onRefresh();
    } catch (error) {
      toast({
        title: 'Error loading dataset',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingCSV(false);
      setCsvProgress(null);
    }
  };

  const handleRunAnalysis = async () => {
    if (!stats || stats.emailCount === 0) {
      toast({
        title: 'No emails to analyze',
        description: 'Load the dataset first before running analysis',
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
        const result = await onAnalyze({ batchSize: 10 });
        
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
        title: 'Pipeline complete!',
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

  const isProcessing = isImporting || isAnalyzing || isComputing || isClearing || isRunningPipeline || isLoadingCSV;
  const hasData = stats && stats.emailCount > 0;
  const needsAnalysis = stats && stats.emailCount > stats.analyzedCount;

  const getProgressPercent = (): number => {
    if (csvProgress) {
      if (csvProgress.phase === 'complete') return 100;
      return csvProgress.total > 0 ? Math.round((csvProgress.current / csvProgress.total) * 100) : 0;
    }
    return analysisProgress;
  };

  const getProgressLabel = (): string => {
    if (csvProgress) {
      if (csvProgress.phase === 'fetching') return 'Fetching CSV...';
      if (csvProgress.phase === 'parsing') return `Parsing: ${csvProgress.current}/${csvProgress.total} (${csvProgress.emailsFound} emails)`;
      return 'Complete';
    }
    if (isRunningPipeline) {
      return `Analyzing: ${analysisProgress}%`;
    }
    return '';
  };

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

      {/* Load Dataset Section */}
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Load the Epstein email dataset (~5,000 email threads) from the bundled CSV file.
        </p>
        
        {(isLoadingCSV || csvProgress) && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>{getProgressLabel()}</span>
              <span>{getProgressPercent()}%</span>
            </div>
            <Progress value={getProgressPercent()} />
          </div>
        )}
        
        <Button 
          onClick={handleLoadCSV} 
          disabled={isProcessing}
          className="w-full"
          variant={hasData ? "outline" : "default"}
        >
          {isLoadingCSV ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Database className="h-4 w-4 mr-2" />
          )}
          {isLoadingCSV ? 'Loading...' : hasData ? 'Reload Dataset' : 'Load Epstein Emails'}
        </Button>
      </div>

      {/* Analysis Pipeline Section */}
      {hasData && (
        <div className="space-y-3 pt-2 border-t border-border">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Analysis Pipeline</span>
            {needsAnalysis && (
              <span className="text-xs text-muted-foreground">
                {stats.analyzedCount}/{stats.emailCount} analyzed
              </span>
            )}
          </div>

          {isRunningPipeline && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Analyzing emails...</span>
                <span>{analysisProgress}%</span>
              </div>
              <Progress value={analysisProgress} />
            </div>
          )}

          <Button
            onClick={handleRunAnalysis}
            disabled={isProcessing || !needsAnalysis}
            className="w-full"
            variant={needsAnalysis ? "default" : "outline"}
          >
            {isRunningPipeline ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Zap className="h-4 w-4 mr-2" />
            )}
            {isRunningPipeline 
              ? 'Running...' 
              : needsAnalysis 
                ? 'Run Analysis Pipeline' 
                : 'Analysis Complete'}
          </Button>

          <Button
            onClick={() => onCompute()}
            disabled={isProcessing}
            variant="outline"
            className="w-full"
            size="sm"
          >
            {isComputing ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Play className="h-4 w-4 mr-2" />
            )}
            Recompute Graph Only
          </Button>
        </div>
      )}

      {/* Clear Data Section */}
      {hasData && (
        <div className="pt-2 border-t border-border">
          <Button
            onClick={handleClearData}
            disabled={isProcessing}
            variant="destructive"
            className="w-full"
            size="sm"
          >
            {isClearing ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4 mr-2" />
            )}
            Clear All Data
          </Button>
        </div>
      )}
    </Card>
  );
}
