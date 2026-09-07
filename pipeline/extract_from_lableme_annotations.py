import json
from pathlib import Path

from PIL import Image

all_labels_path = Path(__file__).resolve().parent.parent / "volumes_backup" / "labels"

arcface_image_path = Path(__file__).resolve().parent.parent / "pipeline" / "arcface_images"

json_files = list(all_labels_path.glob("*.json"))

for json_file in json_files:
    with open(json_file, "r", encoding="utf-8") as f:
        data = json.load(f)

        shapes = data["shapes"]
        image_path = (json_file.parent / data["imagePath"]).resolve()

        if not image_path.exists():
            print(f"Skipping missing image: {image_path}")
            continue

        with Image.open(image_path) as image:
            for i, shape in enumerate(shapes):
                label = shape["label"]
                p1 = shape["points"][0]
                p2 = shape["points"][1]

                left = min(p1[0], p2[0])
                right = max(p1[0], p2[0])
                top = min(p1[1], p2[1])
                bottom = max(p1[1], p2[1])

                # crop image
                cropped_image = image.crop((left, top, right, bottom))

                # folder for save
                folder_path = arcface_image_path / label
                folder_path.mkdir(parents=True, exist_ok=True)

                output_path = folder_path / f"{json_file.stem}_{i}.jpg"
                cropped_image.convert("RGB").save(output_path)
