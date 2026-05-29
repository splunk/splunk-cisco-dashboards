import React, { useRef } from 'react';
import { useDrag, useDrop } from 'react-dnd';
import { cn } from '@/common/lib/utils';
import type { KPIInstance, KPISectionId } from '@/data/kpi-templates';
import { MetricCard } from './MetricCard';

const DND_TYPE = 'health-monitoring-kpi-card';

interface DragItem {
    id: string;
    index: number;
    sectionId: KPISectionId;
}

interface DraggableKPICardProps {
    kpi: KPIInstance;
    index: number;
    sectionId: KPISectionId;
    onMove: (sectionId: KPISectionId, fromIndex: number, toIndex: number) => void;
    onConfigure: (kpi: KPIInstance) => void;
    onExpand: (kpi: KPIInstance) => void;
    onRemove: (kpi: KPIInstance) => void;
}

export const DraggableKPICard: React.FC<DraggableKPICardProps> = ({
    kpi,
    index,
    sectionId,
    onMove,
    onConfigure,
    onExpand,
    onRemove,
}) => {
    const ref = useRef<HTMLDivElement | null>(null);

    const [{ isDragging }, drag] = useDrag({
        type: DND_TYPE,
        item: { id: kpi.instanceId, index, sectionId },
        collect: (monitor) => ({
            isDragging: monitor.isDragging(),
        }),
    });

    const [, drop] = useDrop<DragItem>({
        accept: DND_TYPE,
        hover: (item, monitor) => {
            if (!ref.current || item.sectionId !== sectionId) return;
            const dragIndex = item.index;
            const hoverIndex = index;
            if (dragIndex === hoverIndex) return;

            const hoverBoundingRect = ref.current.getBoundingClientRect();
            const hoverMiddleX =
                (hoverBoundingRect.right - hoverBoundingRect.left) / 2;
            const clientOffset = monitor.getClientOffset();
            if (!clientOffset) return;
            const hoverClientX = clientOffset.x - hoverBoundingRect.left;
            if (dragIndex < hoverIndex && hoverClientX < hoverMiddleX) return;
            if (dragIndex > hoverIndex && hoverClientX > hoverMiddleX) return;

            onMove(sectionId, dragIndex, hoverIndex);
            item.index = hoverIndex;
        },
    });

    drag(drop(ref));

    return (
        <div
            ref={ref}
            className={cn(
                'min-w-0 cursor-grab active:cursor-grabbing',
                isDragging && 'opacity-45'
            )}
        >
            <MetricCard
                kpi={kpi}
                onConfigure={onConfigure}
                onExpand={onExpand}
                onRemove={onRemove}
            />
        </div>
    );
};
