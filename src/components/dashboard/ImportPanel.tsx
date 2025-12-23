import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/components/ui/use-toast';
import { 
  Loader2, 
  Trash2,
  RefreshCw,
  Database,
  CheckCircle,
  Mail,
  GitBranch,
} from 'lucide-react';

interface ImportPanelProps {
  onLoadData: (onProgress?: (stage: string, loaded: number, total: number) => void) => Promise<any>;
  onClear: () => Promise<any>;
  onRefresh: () => void;
  isLoadingData: boolean;
  isClearing: boolean;
  stats: {
    emailCount: number;
    analyzedCount: number;
    personCount: number;
    relationshipCount: number;
    edgeCount?: number;
  } | undefined;
}

export function ImportPanel({
  onLoadData,
  onClear,
  onRefresh,
  isLoadingData,
  isClearing,
  stats,
}: ImportPanelProps) {
  const { toast } = useToast();
  const [loadProgress, setLoadProgress] = useState<{ stage: string; loaded: number; total: number } | null>(null);

  const handleLoadData = async () => {
    try {
      toast({
        title: 'Loading dataset...',
        description: 'This may take a moment for 71,000+ emails',
      });
      
      const result = await onLoadData((stage, loaded, total) => {
        setLoadProgress({ stage, loaded, total });
      });
      
      if (result.success) {
        toast({
          title: 'Dataset loaded successfully!',
          description: `Loaded ${result.edgeCount} edges and ${result.emailCount} emails`,
        });
      } else {
        throw new Error(result.error || 'Unknown error');
      }
      
      onRefresh();
    } catch (error) {
      toast({
        title: 'Error loading dataset',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setLoadProgress(null);
    }
  };

  const handleClearData = async () => {
    if (!confirm('Are you sure you want to delete all data? This cannot be undone.')) return;

    try {
      await onClear();
      toast({
        title: 'Data cleared',
        description: 'All data has been deleted',
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

  const isProcessing = isLoadingData || isClearing;
  const hasData = stats && (stats.emailCount > 0 || (stats.edgeCount || 0) > 0);

  const getProgressPercent = (): number => {
    if (!loadProgress || loadProgress.total === 0) return 0;
    return Math.round((loadProgress.loaded / loadProgress.total) * 100);
  };

  const getProgressLabel = (): string => {
    if (!loadProgress) return '';
    const stageLabel = loadProgress.stage === 'edges' ? 'Loading edges' : 'Loading emails';
    return `${stageLabel}: ${loadProgress.loaded.toLocaleString()}/${loadProgress.total.toLocaleString()}`;
  };

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-foreground">Epstein Email Dataset</h3>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={onRefresh}
          disabled={isProcessing}
        >
          <RefreshCw className={`h-4 w-4 ${isProcessing ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Stats Display */}
      {hasData && (
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Mail className="h-4 w-4" />
            <span>{(stats?.emailCount || 0).toLocaleString()} emails</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <GitBranch className="h-4 w-4" />
            <span>{(stats?.edgeCount || stats?.relationshipCount || 0).toLocaleString()} connections</span>
          </div>
        </div>
      )}

      {/* Load Dataset Section */}
      <div className="space-y-3">
        {!hasData && (
          <p className="text-sm text-muted-foreground">
            Load pre-analyzed Epstein email dataset with sentiment polarity already computed.
          </p>
        )}
        
        {loadProgress && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-foreground">
              <span>{getProgressLabel()}</span>
              <span>{getProgressPercent()}%</span>
            </div>
            <Progress value={getProgressPercent()} />
          </div>
        )}
        
        <Button 
          onClick={handleLoadData} 
          disabled={isProcessing}
          className="w-full"
          variant={hasData ? "outline" : "default"}
        >
          {isLoadingData ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : hasData ? (
            <CheckCircle className="h-4 w-4 mr-2" />
          ) : (
            <Database className="h-4 w-4 mr-2" />
          )}
          {isLoadingData 
            ? 'Loading...' 
            : hasData 
              ? 'Reload Dataset' 
              : 'Load Epstein Dataset'}
        </Button>

        {hasData && (
          <p className="text-xs text-muted-foreground text-center">
            <CheckCircle className="h-3 w-3 inline mr-1 text-green-500" />
            Pre-computed sentiment analysis - graph ready instantly!
          </p>
        )}
      </div>

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
