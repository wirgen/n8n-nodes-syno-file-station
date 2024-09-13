import { IExecuteFunctions, INodeExecutionData, INodeType, INodeTypeDescription } from 'n8n-workflow'
import * as console from 'node:console'

// noinspection JSUnusedGlobalSymbols
export class SynoFileStation implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Synology FileStation',
		name: 'synoFileStation',
		// eslint-disable-next-line n8n-nodes-base/node-class-description-icon-not-svg
		icon: 'file:synoFileStation.png',
		group: ['transform'],
		version: 1,
		description: 'Implements Synology File Station Official API',
		defaults: {
			name: 'Syno FS'
		},
		inputs: ['main'],
		outputs: ['main'],
		credentials: [
			{
				name: 'synoFileStationApi',
				required: true,
			}
		],
		properties: [
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				options: [
					{
						name: 'Upload',
						value: 'upload',
						description: 'Upload file',
						action: 'Upload file',
					},
				],
				default: 'upload',
				noDataExpression: true,
			},
			{
				displayName: 'Path',
				name: 'path',
				type: 'string',
				required: true,
				default: '',
				description: 'A destination folder path starting with a shared folder to which files can be uploaded',
			},
			{
				displayName: 'Create Parent Folders',
				name: 'createParents',
				type: 'boolean',
				default: true,
			},
			{
				displayName: 'Overwrite',
				name: 'overwrite',
				type: 'boolean',
				default: true,
			},
			{
				displayName: 'File Name',
				name: 'filename',
				type: 'string',
				required: true,
				default: '',
			},
			{
				displayName: 'Binary File',
				name: 'binaryData',
				type: 'boolean',
				default: false,
				description: 'Whether the data to upload should be taken from binary field',
			},
			{
				displayName: 'File Content',
				name: 'fileContent',
				type: 'string',
				default: '',
				displayOptions: {
					show: {
						binaryData: [false],
					},
				},
				description: 'The text content of the file to upload',
			},
			{
				displayName: 'Input Binary Field',
				name: 'binaryPropertyName',
				type: 'string',
				default: 'data',
				displayOptions: {
					show: {
						binaryData: [true],
					},
				},
				required: true,
				hint: 'The name of the input binary field containing the file to be uploaded',
			},
		],
	}

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData()
		const returnData: INodeExecutionData[] = []
		const url = (await this.getCredentials('synoFileStationApi', 0)).url as string
		const operation = this.getNodeParameter('operation', 0)

		for (let index = 0; index < items.length; index++) {
			switch (operation) {
				case 'upload':
					try {
						const filename = this.getNodeParameter('filename', index) as string
						const body = new FormData()
						body.append('api', 'SYNO.FileStation.Upload')
						body.append('version', 2)
						body.append('method', 'upload')
						body.append('path', this.getNodeParameter('path', index))
						body.append('create_parents', this.getNodeParameter('createParents', index)!.toString())
						body.append('overwrite', this.getNodeParameter('overwrite', index)!.toString())

						if (this.getNodeParameter('binaryData', index)) {
							const binaryPropertyName = this.getNodeParameter('binaryPropertyName', index)
							this.helpers.assertBinaryData(index, binaryPropertyName)
							body.append(
								'file',
								new Blob([await this.helpers.getBinaryDataBuffer(index, binaryPropertyName)]),
								filename,
							)
						} else {
							body.append(
								'file',
								new Blob([Buffer.from(this.getNodeParameter('fileContent', index) as string, 'utf8')]),
								filename,
							)
						}

						console.log(body)

						const response = await this.helpers.httpRequestWithAuthentication.call(this, 'synoFileStationApi', {
							url: `${url.endsWith('/') ? url.slice(0, -1) : url}/webapi/entry.cgi`,
							method: 'POST',
							body,
							json: true,
						})

						if (response.success) {
							returnData.push({ json: response.data })
						} else {
							throw response.error
						}
					} catch (error: any) {
						console.error(error)

						if (this.continueOnFail()) {
							returnData.push({
								json: {},
								error: error.code.toString(),
							})
							continue
						}

						throw error
					}
					break
			}
		}

		return [returnData]
	}
}
