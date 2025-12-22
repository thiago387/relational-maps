import { useRef, useCallback, useEffect, useState } from 'react';
import ForceGraph2D, { ForceGraphMethods } from 'react-force-graph-2d';
import type { GraphData, GraphNode, GraphLink } from '@/types/graph';
import { getSentimentColor } from '@/lib/api/graph';

interface NetworkGraphProps {
  data: GraphData;
  onNodeClick?: (node: GraphNode) => void;
  onLinkClick?: (link: GraphLink) => void;
  selectedNodeId?: string | null;
}

export function NetworkGraph({ data, onNodeClick, onLinkClick, selectedNodeId }: NetworkGraphProps) {
  const fgRef = useRef<ForceGraphMethods>();
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  useEffect(() => {
    if (!containerRef.current) return;
    
    const resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });
    
    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    if (fgRef.current && data.nodes.length > 0) {
      fgRef.current.d3Force('charge')?.strength(-200);
      fgRef.current.d3Force('link')?.distance(80);
    }
  }, [data]);

  const handleNodeClick = useCallback((node: any) => {
    if (onNodeClick) {
      onNodeClick(node as GraphNode);
    }
    
    // Center on clicked node
    if (fgRef.current) {
      fgRef.current.centerAt(node.x, node.y, 1000);
      fgRef.current.zoom(2, 1000);
    }
  }, [onNodeClick]);

  const handleLinkClick = useCallback((link: any) => {
    if (onLinkClick) {
      onLinkClick(link as GraphLink);
    }
  }, [onLinkClick]);

  const nodeCanvasObject = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const label = node.name;
    const fontSize = Math.max(12 / globalScale, 3);
    const nodeR = Math.sqrt(node.val) * 2;
    
    // Node circle
    ctx.beginPath();
    ctx.arc(node.x, node.y, nodeR, 0, 2 * Math.PI);
    ctx.fillStyle = node.color;
    ctx.fill();
    
    // Selection ring
    if (selectedNodeId === node.id) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3 / globalScale;
      ctx.stroke();
    }
    
    // Sentiment indicator ring
    if (node.avgSentiment !== null) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, nodeR + 3, 0, 2 * Math.PI);
      ctx.strokeStyle = getSentimentColor(node.avgSentiment);
      ctx.lineWidth = 2 / globalScale;
      ctx.stroke();
    }
    
    // Label
    if (globalScale > 0.5) {
      ctx.font = `${fontSize}px Sans-Serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.fillText(label, node.x, node.y + nodeR + 2);
    }
  }, [selectedNodeId]);

  const linkCanvasObject = useCallback((link: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const start = link.source;
    const end = link.target;
    
    if (typeof start !== 'object' || typeof end !== 'object') return;
    
    const lineWidth = Math.max(link.value, 1) / globalScale;
    
    // Draw main line
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.strokeStyle = link.color;
    ctx.lineWidth = lineWidth;
    ctx.globalAlpha = 0.6;
    ctx.stroke();
    ctx.globalAlpha = 1;
    
    // Draw direction arrow if there's asymmetry
    if (link.emailsAtoB !== link.emailsBtoA) {
      const dominant = link.emailsAtoB > link.emailsBtoA ? 'AtoB' : 'BtoA';
      const midX = (start.x + end.x) / 2;
      const midY = (start.y + end.y) / 2;
      
      const dx = dominant === 'AtoB' ? end.x - start.x : start.x - end.x;
      const dy = dominant === 'AtoB' ? end.y - start.y : start.y - end.y;
      const angle = Math.atan2(dy, dx);
      
      const arrowSize = 5 / globalScale;
      
      ctx.beginPath();
      ctx.moveTo(midX, midY);
      ctx.lineTo(
        midX - arrowSize * Math.cos(angle - Math.PI / 6),
        midY - arrowSize * Math.sin(angle - Math.PI / 6)
      );
      ctx.moveTo(midX, midY);
      ctx.lineTo(
        midX - arrowSize * Math.cos(angle + Math.PI / 6),
        midY - arrowSize * Math.sin(angle + Math.PI / 6)
      );
      ctx.strokeStyle = link.color;
      ctx.lineWidth = 2 / globalScale;
      ctx.stroke();
    }
  }, []);

  if (data.nodes.length === 0) {
    return (
      <div 
        ref={containerRef}
        className="w-full h-full flex items-center justify-center bg-background/50 rounded-lg border border-border"
      >
        <div className="text-center text-muted-foreground">
          <p className="text-lg mb-2">No graph data available</p>
          <p className="text-sm">Import emails and run analysis to see the network</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full h-full bg-background/30 rounded-lg overflow-hidden">
      <ForceGraph2D
        ref={fgRef}
        graphData={data}
        width={dimensions.width}
        height={dimensions.height}
        nodeCanvasObject={nodeCanvasObject}
        linkCanvasObject={linkCanvasObject}
        onNodeClick={handleNodeClick}
        onLinkClick={handleLinkClick}
        nodePointerAreaPaint={(node, color, ctx) => {
          ctx.beginPath();
          ctx.arc(node.x!, node.y!, Math.sqrt(node.val as number) * 2 + 5, 0, 2 * Math.PI);
          ctx.fillStyle = color;
          ctx.fill();
        }}
        backgroundColor="transparent"
        linkDirectionalArrowLength={0}
        cooldownTicks={100}
        warmupTicks={50}
      />
    </div>
  );
}
