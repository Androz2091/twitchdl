const fetch = require('node-fetch');
const { exec } = require('child_process');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const ora = require('ora');

const clientID = 'kimne78kx3ncx6brgo4mv6wki5h1ko';
const sha256HashData = '07e99e4d56c5a7c67117a154777b0baf85a5ffefa393b213f4bc712ccaf85dd6';
const sha256HashMetadata = '226edb3e692509f727fd56821f5653c05740242c82b0388883e0c0e75dcbf687';

const argv = yargs(hideBin(process.argv)).argv

const twitchVideoRegex = /^https:\/\/\w+.cloudfront.net\/[a-z0-9]+_([a-z0-9]+)_[0-9]+_[0-9]+/;
const getChannelLogin = (videoURL) => videoURL.match(twitchVideoRegex)[1];
const getIndexURL = (videoURL) => videoURL.match(twitchVideoRegex)[0] + '/chunked/index-dvr.m3u8';

const fetchVideoData = async (videoID, authToken) => {
	const resVideoData = await fetch('https://gql.twitch.tv/gql', {
		method: 'POST',
		headers: {
			'Authorization':`OAuth ${authToken}`,
			'Client-Id': clientID
		},
		body: JSON.stringify({
			operationName: 'VideoPlayer_VODSeekbarPreviewVideo',
			variables: {
				includePrivate: false,
				videoID
			},
			extensions: {
				persistedQuery: {
					version: 1,
					sha256Hash: sha256HashData
				}
			}
		})
	});

	const data = await resVideoData.json();

	const videoURL = data.data.video?.seekPreviewsURL;
	if (!videoURL) throw new Error('Unknown video');

	const resVideoMetaData = await fetch('https://gql.twitch.tv/gql', {
		method: 'POST',
		headers: {
			'Authorization':`OAuth ${authToken}`,
			'Client-Id': clientID
		},
		body: JSON.stringify({
			operationName: 'VideoMetadata',
			variables: {
				channelLogin: getChannelLogin(videoURL),
				videoID
			},
			extensions: {
				persistedQuery: {
					version: 1,
					sha256Hash: sha256HashMetadata
				}
			}
		})
	});

	const metadata = await resVideoMetaData.json();

	return {
		videoIndexURL: getIndexURL(videoURL),
		videoName: metadata.data.video.title
	};
};

const ffmpegDownload = (indexURL, output) => {
	const spinner = ora(`Downloading ${output}.mp4`).start();
	exec(`ffmpeg -i "${indexURL}" -c copy -bsf:a aac_adtstoasc "${output}.mp4"`, () => {
		spinner.succeed(`Downloaded ${output}.mp4`);
	});
};

const videoID = argv['_'][0];
const output = argv.output;
const auth = argv.auth;
if (!videoID) throw new Error('Video ID argument is required!');

fetchVideoData(videoID.toString(), auth).then(({ videoIndexURL, videoName }) => {
	ffmpegDownload(videoIndexURL, (output || videoName));
});
