from pathlib import Path

all_labels_path = Path(__file__).resolve().parent.parent / "volumes_backup" / "labels"

json_files = list(all_labels_path.glob("*.json"))

for json_file in json_files:
    with open(json_file, "r", encoding="utf-8") as f:
        data = json_file.load(f)

        shapes = data["shapes"]
        image = data["imagePath"]
        
        for shape in shapes:
            label = shape["label"]
            p1 = shape["points"][0]
            p2 = shape["points"][1]
            
            # crop image 
            cropped_image = ""
            # folder for save
            folder_path = ""
            