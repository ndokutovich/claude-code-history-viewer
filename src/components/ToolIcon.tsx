import {
  Bot,
  Edit,
  FileEdit,
  FileText,
  Globe,
  Search,
  Terminal,
  Wrench,
} from "lucide-react";
import { cn } from "../utils/cn";

type Props = {
  toolName: string;
  className?: string;
};

export const ToolIcon = ({ toolName, className }: Props) => {
  const name = toolName.toLowerCase();
  if (name.includes("bash") || name.includes("command"))
    return <Terminal className={cn("w-4 h-4", className)} />;
  if (name.includes("read") || name.includes("file"))
    return <FileText className={cn("w-4 h-4", className)} />;
  if (name.includes("edit") || name.includes("write"))
    return <Edit className={cn("w-4 h-4", className)} />;
  if (name.includes("search") || name.includes("grep"))
    return <Search className={cn("w-4 h-4", className)} />;
  if (name.includes("todo")) return <FileEdit className="w-4 h-4" />;
  if (name.includes("web") || name.includes("fetch"))
    return <Globe className={cn("w-4 h-4", className)} />;
  if (name.includes("task") || name.includes("agent"))
    return <Bot className={cn("w-4 h-4", className)} />;
  return <Wrench className={cn("w-4 h-4", className)} />;
};
