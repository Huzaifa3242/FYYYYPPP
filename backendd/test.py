from app.services.video_inference import run_video_inference

if __name__ == "__main__":
    video_path = r"C:\Users\huzai\Desktop\FYP\backend\tester.mp4"  # yahan apna real path
    res = run_video_inference(video_path, conf_threshold=0.7)
    print("OVERALL:", res["overall_summary"])
    print("NUM CHUNKS:", len(res["chunks"]))
    for ch in res["chunks"]:
        print(
            "Chunk", ch["chunk_index"],
            "overall:", ch["overall"],
            "segments:", len(ch["segments"])
        )
