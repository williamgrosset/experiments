import type { Experiment } from "@experiments/shared";
import { Button } from "@/components/button";
import { Modal } from "@/components/modal";

interface DeleteExperimentModalProps {
  experiment: Experiment;
  open: boolean;
  deleting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteExperimentModal({
  experiment,
  open,
  deleting,
  onClose,
  onConfirm,
}: DeleteExperimentModalProps) {
  return (
    <Modal open={open} onClose={onClose} title="Delete experiment" maxWidth="max-w-sm">
      <p className="mt-2 text-sm text-zinc-500">
        Are you sure you want to delete{" "}
        <span className="font-medium text-zinc-700">{experiment.name}</span>? This will permanently
        remove the experiment, its variants, and allocations. The environment config will be
        re-published to reflect this change.
      </p>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" size="sm" onClick={onClose} disabled={deleting}>
          Cancel
        </Button>
        <Button
          variant="danger"
          size="sm"
          onClick={onConfirm}
          loading={deleting}
          loadingText="Deleting..."
        >
          Delete
        </Button>
      </div>
    </Modal>
  );
}
