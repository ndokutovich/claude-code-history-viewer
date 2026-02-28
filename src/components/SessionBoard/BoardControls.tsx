/**
 * Board Controls
 *
 * Toolbar for the Session Board with zoom level, brush filters, and date picker.
 */

import type { ZoomLevel, DateFilter, ActiveBrush } from "../../types/board.types";
import { Layout, Layers, Eye, Filter, Lock } from "lucide-react";
import { clsx } from "clsx";
import { DatePickerHeader } from "../ui/DatePickerHeader";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTranslation } from "react-i18next";

interface BoardControlsProps {
  zoomLevel: ZoomLevel;
  onZoomChange: (level: ZoomLevel) => void;
  activeBrush: ActiveBrush | null;
  stickyBrush?: boolean;
  onBrushChange: (brush: ActiveBrush | null) => void;
  toolOptions?: string[];
  fileOptions?: string[];
  mcpServerOptions?: string[];
  shellCommandOptions?: string[];
  availableTools?: string[];
  availableFiles?: string[];
  availableMcpServers?: string[];
  availableShellCommands?: string[];
  dateFilter?: DateFilter;
  setDateFilter?: (filter: DateFilter) => void;
}

export const BoardControls = ({
  zoomLevel,
  onZoomChange,
  activeBrush,
  stickyBrush = false,
  onBrushChange,
  toolOptions = [],
  fileOptions = [],
  mcpServerOptions = [],
  shellCommandOptions = [],
  availableTools = [],
  availableFiles = [],
  availableMcpServers = [],
  availableShellCommands = [],
  dateFilter,
  setDateFilter,
}: BoardControlsProps) => {
  const { t } = useTranslation("components");

  return (
    <div className="h-10 px-4 border-b border-border/50 bg-card/30 flex items-center justify-between shrink-0 backdrop-blur-md select-none">
      {/* Zoom Controls */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1 p-0.5 bg-muted/30 rounded-lg border border-border/50">
          <button
            onClick={() => onZoomChange(0)}
            className={clsx(
              "p-1 rounded-md transition-all",
              zoomLevel === 0
                ? "bg-background shadow-sm text-accent"
                : "text-muted-foreground hover:text-foreground"
            )}
            title={t("analytics.pixelView", { defaultValue: "Pixel View" })}
            aria-label={t("analytics.pixelView", {
              defaultValue: "Pixel View",
            })}
          >
            <Layout className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onZoomChange(1)}
            className={clsx(
              "p-1 rounded-md transition-all",
              zoomLevel === 1
                ? "bg-background shadow-sm text-accent"
                : "text-muted-foreground hover:text-foreground"
            )}
            title={t("analytics.skimView", { defaultValue: "Skim View" })}
            aria-label={t("analytics.skimView", {
              defaultValue: "Skim View",
            })}
          >
            <Layers className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onZoomChange(2)}
            className={clsx(
              "p-1 rounded-md transition-all",
              zoomLevel === 2
                ? "bg-background shadow-sm text-accent"
                : "text-muted-foreground hover:text-foreground"
            )}
            title={t("analytics.readView", { defaultValue: "Read View" })}
            aria-label={t("analytics.readView", {
              defaultValue: "Read View",
            })}
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Brushing Dropdowns */}
        <div className="hidden lg:flex items-center gap-1.5">
          <Filter className="w-3 h-3 text-muted-foreground mr-0.5" />

          <Select
            value={
              activeBrush?.type === "tool" ? activeBrush.value : ""
            }
            onValueChange={(v) =>
              onBrushChange(
                v === "_ALL_" ? null : { type: "tool", value: v }
              )
            }
          >
            <SelectTrigger className="h-7 w-32 text-[10px] bg-muted/20 border-border/30 px-2">
              <SelectValue
                placeholder={t("analytics.tool", {
                  defaultValue: "TOOL",
                })}
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                value="_ALL_"
                className="text-[10px] font-extrabold text-foreground uppercase tracking-wide"
              >
                {t("analytics.all", { defaultValue: "ALL" })}
              </SelectItem>
              {toolOptions.map((toolOption) => (
                <SelectItem
                  key={toolOption}
                  value={toolOption}
                  className="text-[10px]"
                  disabled={
                    availableTools
                      ? !availableTools.includes(toolOption)
                      : false
                  }
                >
                  {toolOption.toUpperCase()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* MCP servers */}
          {mcpServerOptions.length > 0 && (
            <Select
              value={
                activeBrush?.type === "mcp" ? activeBrush.value : ""
              }
              onValueChange={(v) =>
                onBrushChange(
                  v === "_ALL_" ? null : { type: "mcp", value: v }
                )
              }
            >
              <SelectTrigger className="h-7 w-32 text-[10px] bg-muted/20 border-border/30 px-2">
                <SelectValue
                  placeholder={t("analytics.mcp", {
                    defaultValue: "MCP",
                  })}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  value="_ALL_"
                  className="text-[10px] font-extrabold text-foreground uppercase tracking-wide"
                >
                  {t("analytics.all", { defaultValue: "ALL" })}
                </SelectItem>
                {mcpServerOptions.map((server) => (
                  <SelectItem
                    key={server}
                    value={server}
                    className="text-[10px]"
                    disabled={
                      availableMcpServers
                        ? !availableMcpServers.includes(server)
                        : false
                    }
                  >
                    {server}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Commands */}
          {shellCommandOptions.length > 0 && (
            <Select
              value={
                activeBrush?.type === "command"
                  ? activeBrush.value
                  : ""
              }
              onValueChange={(v) =>
                onBrushChange(
                  v === "_ALL_"
                    ? null
                    : { type: "command", value: v }
                )
              }
            >
              <SelectTrigger className="h-7 w-40 text-[10px] bg-muted/20 border-border/30 px-2">
                <SelectValue
                  placeholder={t("analytics.command", {
                    defaultValue: "COMMAND",
                  })}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  value="_ALL_"
                  className="text-[10px] font-extrabold text-foreground uppercase tracking-wide"
                >
                  {t("analytics.all", { defaultValue: "ALL" })}
                </SelectItem>
                {shellCommandOptions.map((cmd) => (
                  <SelectItem
                    key={cmd}
                    value={cmd}
                    className="text-[10px] font-mono"
                    disabled={
                      availableShellCommands
                        ? !availableShellCommands.includes(cmd)
                        : false
                    }
                    title={cmd}
                  >
                    {cmd.length > 35
                      ? cmd.substring(0, 35) + "..."
                      : cmd}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Select
            value={
              activeBrush?.type === "file" ? activeBrush.value : ""
            }
            onValueChange={(v) =>
              onBrushChange(
                v === "_ALL_" ? null : { type: "file", value: v }
              )
            }
          >
            <SelectTrigger className="h-7 w-40 text-[10px] bg-muted/20 border-border/30 px-2">
              <SelectValue
                placeholder={t("analytics.file", {
                  defaultValue: "FILE",
                })}
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                value="_ALL_"
                className="text-[10px] font-extrabold text-foreground uppercase tracking-wide"
              >
                {t("analytics.all", { defaultValue: "ALL" })}
              </SelectItem>
              {fileOptions.map((f) => (
                <SelectItem
                  key={f}
                  value={f}
                  className="text-[10px]"
                  disabled={
                    availableFiles
                      ? !availableFiles.includes(f)
                      : false
                  }
                >
                  {f.split(/[\\/]/).pop() || ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Date Filter */}
        {dateFilter && setDateFilter && (
          <DatePickerHeader
            dateFilter={dateFilter}
            setDateFilter={setDateFilter}
          />
        )}

        <div className="flex items-center gap-2">
          {activeBrush && stickyBrush && (
            <div className="bg-accent/10 p-1 rounded">
              <Lock className="w-3 h-3 fill-accent text-accent" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
