import { Check } from "lucide-react";

interface TimelineItem {
  id: number;
  status: string;
  date: string | null;
  completed: boolean;
  isLatest: boolean;
}

interface OrderTimelineProps {
  timeline: TimelineItem[];
}

export default function OrderTimeline({ timeline }: OrderTimelineProps) {
  return (
    <div className="space-y-0">
      {timeline.map((item, index) => {
        const isLast = index === timeline.length - 1;
        const statusClass = item.completed 
          ? "bg-secondary text-white" 
          : "bg-neutral-200 text-neutral-500";
        const lineClass = item.completed 
          ? "bg-secondary" 
          : "bg-neutral-200";

        return (
          <div key={`${item.id}-${index}`} className="flex items-start space-x-4">
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full ${statusClass} flex items-center justify-center text-sm font-medium flex-shrink-0`}>
                {item.completed ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <span>{index + 1}</span>
                )}
              </div>
              {!isLast && (
                <div className={`w-0.5 h-12 ${lineClass} mt-2`}></div>
              )}
            </div>
            <div className="flex-1 pb-8">
              <h4 className={`font-medium ${item.completed ? 'text-neutral-800' : 'text-neutral-500'}`}>
                {item.status}
              </h4>
              {item.date ? (
                <p className="text-sm text-neutral-500 mt-1">
                  {new Date(item.date).toLocaleString()}
                </p>
              ) : (
                <p className="text-sm text-neutral-400 mt-1">
                  {item.completed ? 'Completed' : 'Pending'}
                </p>
              )}
              {item.isLatest && item.completed && (
                <span className="inline-block mt-2 px-2 py-1 bg-accent text-white text-xs rounded-full">
                  Latest Update
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
