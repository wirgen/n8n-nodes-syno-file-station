import { IAuthenticateGeneric, ICredentialType, INodeProperties } from 'n8n-workflow'
import {
	ICredentialDataDecryptedObject,
	ICredentialTestRequest,
	IDataObject,
	IHttpRequestHelper
} from 'n8n-workflow/dist/Interfaces'

import OTPAuth from 'otpauth'

// noinspection JSUnusedGlobalSymbols
export class SynoFileStationApi implements ICredentialType {
	name = 'synoFileStationApi'

	displayName = 'Synology FileStation API'

	properties: INodeProperties[] = [
		{
			displayName: 'URL',
			name: 'url',
			type: 'string',
			required: true,
			default: '',
			placeholder: 'https://example.synology.me',
		},
		{
			displayName: 'Username',
			name: 'username',
			type: 'string',
			required: true,
			default: '',
		},
		{
			displayName: 'Password',
			name: 'password',
			type: 'string',
			typeOptions: {
				password: true,
			},
			required: true,
			default: '',
		},
		{
			displayName: 'Need 2FA',
			name: 'need2fa',
			type: 'boolean',
			default: false,
		},
		{
			displayName: 'TOTP Secret',
			name: 'totpSecret',
			type: 'string',
			typeOptions: {
				password: true,
			},
			displayOptions: {
				show: {
					need2fa: [true],
				},
			},
			required: true,
			default: '',
		},
		{
			displayName: 'SID',
			name: 'sid',
			type: 'hidden',
			typeOptions: {
				expirable: true,
			},
			default: '',
		},
	]

	async preAuthentication(this: IHttpRequestHelper, credentials: ICredentialDataDecryptedObject): Promise<IDataObject> {
		const url = credentials.url as string
		const qs: Record<string, number | string> = {
			api: 'SYNO.API.Auth',
			version: 6,
			method: 'login',
			account: credentials.username as string,
			passwd: credentials.password as string,
			session: 'n8nSynoFS',
			format: 'sid',
		}

		if (credentials.need2fa) {
			const totp = new OTPAuth.TOTP({
				secret: credentials.totpSecret as string,
				algorithm: 'sha1',
				digits: 6,
				period: 30,
			})
			qs.otp_code = totp.generate()
		}

		const response = await this.helpers.httpRequest({
			method: 'GET',
			url: `${url.endsWith('/') ? url.slice(0, -1) : url}/webapi/entry.cgi`,
			qs,
			json: true,
		})

		return {
			sid: response.success ? response.data.sid : '',
		}
	}

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			url: '',
			qs: {
				_sid: '={{$credentials.sid}}',
			},
		},
	}

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.url.replace(new RegExp("/$"), "")}}',
			url: '/webapi/entry.cgi',
			qs: {
				api: 'SYNO.FileStation.Info',
				version: 2,
				method: 'get',
			},
			json: true,
		},
		rules: [
			{
				type: 'responseSuccessBody',
				properties: {
					key: 'success',
					value: false,
					message: 'Error occurred during authentication',
				},
			}
		],
	}
}
