"use client";

// รูปแนบในงาน — ลากวาง/เลือกได้หลายรูป · ลากเรียงได้ · รูปแรก = ปกบนการ์ด
// รองรับรูป iPhone (HEIC) · ย่อก่อนส่งใน addTaskImage · กล่องกลางอยู่ที่ components/aoo/image-dropzone

import { useEffect, useState } from "react";
import { ImageDropzone, type ImageDropzoneItem } from "@/components/aoo";
import { useToast } from "@/hooks/useToast";
import {
  addTaskImage,
  deleteTaskImage,
  getTaskImages,
  reorderTaskImages,
  type TaskImage,
} from "@/lib/services/taskService";

export default function TaskImages({
  taskId,
  userId,
  readOnly,
  onChanged,
}: {
  taskId: string;
  userId: string;
  /** ดูได้อย่างเดียว — งานที่ไม่ได้สร้างหรือรับผิดชอบ */
  readOnly?: boolean;
  /** รูป/ลำดับเปลี่ยน — ให้บอร์ดโหลดปกใหม่ตอนปิด */
  onChanged: () => void;
}) {
  const { showToast } = useToast();
  const [images, setImages] = useState<TaskImage[] | null>(null);
  /** ช่องหลอกระหว่างอัปโหลด — โชว์รูปจากเครื่องพร้อมวงหมุน */
  const [pending, setPending] = useState<ImageDropzoneItem[]>([]);

  const load = () =>
    getTaskImages(taskId)
      .then(setImages)
      .catch((e) => showToast(e.message, "error"));

  useEffect(() => {
    load();
  }, [taskId]); // eslint-disable-line react-hooks/exhaustive-deps

  const upload = async (files: File[]) => {
    const temps = files.map((f, i) => ({
      id: `pending-${Date.now()}-${i}`,
      url: URL.createObjectURL(f),
      pending: true,
    }));
    setPending((p) => [...p, ...temps]);
    let failed = 0;
    for (const [i, f] of files.entries()) {
      try {
        await addTaskImage(taskId, f, userId);
      } catch (e) {
        failed++;
        console.error(e);
      }
      URL.revokeObjectURL(temps[i].url);
      setPending((p) => p.filter((x) => x.id !== temps[i].id));
    }
    if (failed) showToast(`อัปโหลดไม่สำเร็จ ${failed} รูป`, "error");
    onChanged();
    load();
  };

  const remove = async (id: string) => {
    const img = images?.find((x) => x.id === id);
    if (!img) return;
    try {
      await deleteTaskImage(img);
      setImages((prev) => prev?.filter((x) => x.id !== id) ?? prev);
      onChanged();
    } catch (e) {
      showToast((e as Error).message, "error");
    }
  };

  const reorder = async (ids: string[]) => {
    const prev = images;
    setImages((cur) => (cur ? ids.map((id) => cur.find((x) => x.id === id)!).filter(Boolean) : cur));
    try {
      await reorderTaskImages(ids.filter((id) => !id.startsWith("pending-")));
      onChanged();
    } catch (e) {
      setImages(prev);
      showToast((e as Error).message, "error");
    }
  };

  if (!images) return null;
  if (readOnly && !images.length) return <p className="text-sm text-gray-500">ไม่มีรูป</p>;

  return (
    <ImageDropzone
      items={[...images.map((i) => ({ id: i.id, url: i.url })), ...pending]}
      onFilesPicked={upload}
      onRemove={remove}
      onReorder={reorder}
      readOnly={readOnly}
      coverLabel="ปก"
    />
  );
}
