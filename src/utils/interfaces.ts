export interface NFTConfig {
    uploadPath: string;
    imgFileName: string;
    imgType: string;
    imgName: string;
    description: string;
    imageURI: string;
    attributes: Array<{
      trait_type: string;
      value: string;
    }>;
    properties: {
      files: Array<{
        uri: string;
        type: string;
      }>;
      category: string;
    };
  }