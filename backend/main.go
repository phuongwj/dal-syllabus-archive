package main

import (
	s3Client "dal-syllabus/s3"
	"context"
	"os"
	"log"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)


func main() {
	// Create an Amazon S3 service client
	client := s3Client.NewClient()

	output, err := client.ListObjectsV2(context.TODO(), &s3.ListObjectsV2Input{
		Bucket: aws.String(os.Getenv("AWS_BUCKET_NAME")),
	})
	if err != nil {
		log.Fatal(err)
	}

	log.Println("first page results")
	for _, object := range output.Contents {
		log.Printf("key=%s, size=%d", aws.ToString(object.Key), *object.Size)
	}
}