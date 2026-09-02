import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { listSettings } from "@/lib/ai/settings";
import { donoDaRota } from "@/lib/brandville/contexto-da-rota";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const contexto = await donoDaRota(request);
  if (!contexto.ok) return contexto.resposta;
  const workspaceId = contexto.workspaceId;

  const body = await request.json().catch(() => null);
  const isActive = body?.isActive as boolean | undefined;

  if (typeof isActive !== "boolean") {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("ai_settings")
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("workspace_id", workspaceId);

  if (error) {
    return NextResponse.json({ error: "update_failed", message: error.message }, { status: 500 });
  }

  const settings = await listSettings(workspaceId);
  return NextResponse.json({ settings });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const contexto = await donoDaRota(request);
  if (!contexto.ok) return contexto.resposta;
  const workspaceId = contexto.workspaceId;

  const supabase = await createClient();
  const { error } = await supabase.from("ai_settings").delete().eq("id", id).eq("workspace_id", workspaceId);

  if (error) {
    return NextResponse.json({ error: "delete_failed", message: error.message }, { status: 500 });
  }

  const settings = await listSettings(workspaceId);
  return NextResponse.json({ settings });
}
