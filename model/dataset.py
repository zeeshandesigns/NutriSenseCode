"""
PyTorch Dataset for NutriSense AI.
Handles augmentation, normalisation, train/val splitting, and class weight computation.
"""

import json
from pathlib import Path

import numpy as np
import torch
from PIL import Image
from sklearn.utils.class_weight import compute_class_weight
from torch.utils.data import DataLoader, Dataset, random_split
from torchvision import transforms

IMAGENET_MEAN = [0.485, 0.456, 0.406]
IMAGENET_STD  = [0.229, 0.224, 0.225]
IMAGE_SIZE    = 224
IMG_EXTS      = {".jpg", ".jpeg", ".png", ".webp"}


def get_transforms(augment: bool) -> transforms.Compose:
    if augment:
        return transforms.Compose([
            transforms.Resize((IMAGE_SIZE + 32, IMAGE_SIZE + 32)),
            transforms.RandomCrop(IMAGE_SIZE),
            transforms.RandomHorizontalFlip(),
            transforms.RandomRotation(15),
            transforms.ColorJitter(brightness=0.2, contrast=0.2, saturation=0.1, hue=0.05),
            transforms.ToTensor(),
            transforms.Normalize(IMAGENET_MEAN, IMAGENET_STD),
            transforms.RandomErasing(p=0.1, scale=(0.02, 0.1)),
        ])
    return transforms.Compose([
        transforms.Resize((IMAGE_SIZE, IMAGE_SIZE)),
        transforms.ToTensor(),
        transforms.Normalize(IMAGENET_MEAN, IMAGENET_STD),
    ])


class FoodDataset(Dataset):
    def __init__(self, root: str, class_index: dict[str, str], augment: bool = False):
        self.transform = get_transforms(augment)
        self.label_to_idx = {v: int(k) for k, v in class_index.items()}
        self.num_classes = len(class_index)
        self.samples: list[tuple[str, int]] = []

        for label, idx in self.label_to_idx.items():
            class_dir = Path(root) / label
            if not class_dir.exists():
                continue
            for img_path in sorted(class_dir.iterdir()):
                if img_path.suffix.lower() in IMG_EXTS:
                    self.samples.append((str(img_path), idx))

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, i):
        path, label = self.samples[i]
        try:
            img = Image.open(path).convert("RGB")
        except Exception:
            img = Image.new("RGB", (IMAGE_SIZE, IMAGE_SIZE), (128, 128, 128))
        return self.transform(img), label

    def class_weights(self) -> torch.Tensor:
        labels = [s[1] for s in self.samples]
        classes = list(range(self.num_classes))
        weights = compute_class_weight("balanced", classes=np.array(classes), y=np.array(labels))
        return torch.tensor(weights, dtype=torch.float32)


def build_dataloaders(
    dataset_dir: str,
    class_index_path: str,
    val_split: float = 0.2,
    batch_size: int = 32,
    num_workers: int = 2,
) -> tuple[DataLoader, DataLoader, torch.Tensor, int]:
    with open(class_index_path, encoding="utf-8") as f:
        class_index = json.load(f)

    full = FoodDataset(dataset_dir, class_index, augment=False)
    class_weights = full.class_weights()
    num_classes = full.num_classes

    val_size = int(len(full) * val_split)
    train_size = len(full) - val_size
    train_sub, val_sub = random_split(
        full, [train_size, val_size],
        generator=torch.Generator().manual_seed(42),
    )

    # Apply augmentation to train split
    train_sub.dataset = FoodDataset(dataset_dir, class_index, augment=True)

    train_loader = DataLoader(train_sub, batch_size=batch_size, shuffle=True,
                              num_workers=num_workers, pin_memory=True)
    val_loader   = DataLoader(val_sub,   batch_size=batch_size, shuffle=False,
                              num_workers=num_workers, pin_memory=True)

    print(f"Dataset: {len(full):,} images, {num_classes} classes")
    print(f"Train: {train_size:,}  Val: {val_size:,}  Batch: {batch_size}")
    return train_loader, val_loader, class_weights, num_classes
