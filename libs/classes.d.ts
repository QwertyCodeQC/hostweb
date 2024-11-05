declare class HWBuilder {
    constructor();
    buildFileStructure(dirPath: string, exclude: string[] | undefined, doMinify: boolean, debug: boolean, parsemd: boolean): Promise<any>;
    compressFile(inputPath: string, outputPath: string): Promise<void>;
    createHWFile(projectDir: string, outputFilePath: string, excludeFolders: string[] | undefined, gzip: boolean, debug: boolean, doMinify: boolean, useHWAPI: boolean, parsemd: boolean): Promise<void>;
}
export { HWBuilder };
