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

type Props = {
  toolName: string;
};

export const ToolIcon = ({ toolName }: Props) => {
  const name = toolName.toLowerCase();
  if (name.includes("bash") || name.includes("command"))
    return <Terminal className="w-4 h-4" />;
  if (name.includes("read") || name.includes("file"))
    return <FileText className="w-4 h-4" />;
  if (name.includes("edit") || name.includes("write"))
    return <Edit className="w-4 h-4" />;
  if (name.includes("search") || name.includes("grep"))
    return <Search className="w-4 h-4" />;
  if (name.includes("todo")) return <FileEdit className="w-4 h-4" />;
  if (name.includes("web") || name.includes("fetch"))
    return <Globe className="w-4 h-4" />;
  if (name.includes("task") || name.includes("agent"))
    return <Bot className="w-4 h-4" />;
  return <Wrench className="w-4 h-4" />;
};
