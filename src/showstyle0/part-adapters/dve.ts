import { BlueprintResultPart, IBlueprintPiece, PieceLifespan, TSR } from '@sofie-automation/blueprints-integration'
import { PartContext } from '../../common/context'
import { literal } from '../../common/util'
import { StudioConfig } from '../../studio0/helpers/config'
import { AtemLayers } from '../../studio0/layers'
import { DVEProps, PartProps } from '../definitions'
import { createAtemInputTimelineObjects } from '../helpers/atem'
import { getClipPlayerInput } from '../helpers/clips'
import { DVEDesigns, DVELayouts, dveLayoutToContent } from '../helpers/dve'
import { parseGraphicsFromObjects } from '../helpers/graphics'
import { createScriptPiece } from '../helpers/script'
import { getSourceInfoFromRaw } from '../helpers/sources'
import { getOutputLayerForSourceLayer, SourceLayer } from '../layers'

const SUPER_SOURCE_LATENCY = 80

export function generateDVEPart(context: PartContext, part: PartProps<DVEProps>): BlueprintResultPart {
	const config = context.getStudioConfig() as StudioConfig
	// const sourceInfo = getSourceInfoFromRaw(config, part.payload.input1)

	const layout = DVEDesigns[DVELayouts.TwoBox]
	const boxes: TSR.SuperSourceBox[] = part.payload.inputs.map((input, i) => {
		let source = undefined
		if ('fileName' in input) {
			source = getClipPlayerInput(config)
		} else {
			source = getSourceInfoFromRaw(config, input)
		}
		return {
			...layout[i],
			source: source?.input || 0,
		}
	})

	const cameraPiece: IBlueprintPiece = {
		enable: {
			start: 0,
		},
		externalId: part.payload.externalId,
		name: `DVE`, // TODO
		lifespan: PieceLifespan.WithinPart,
		sourceLayerId: SourceLayer.DVE,
		outputLayerId: getOutputLayerForSourceLayer(SourceLayer.DVE),
		content: {
			...dveLayoutToContent(config, { boxes }, part.payload.inputs),

			timelineObjects: [
				...createAtemInputTimelineObjects(6000, SUPER_SOURCE_LATENCY),

				literal<TSR.TimelineObjAtemSsrcProps>({
					id: '',
					enable: { while: 1 },
					priority: 1,
					layer: AtemLayers.AtemSuperSourceProps,
					content: {
						deviceType: TSR.DeviceType.ATEM,
						type: TSR.TimelineContentTypeAtem.SSRCPROPS,
						ssrcProps: {
							artFillSource: 3010, // atem mediaplayer1
							artCutSource: 3011,
							artOption: 0, // bg
							artPreMultiplied: true,
							borderEnabled: false,
						},
					},
				}),

				literal<TSR.TimelineObjAtemSsrc>({
					id: '',
					enable: { start: 0 },
					priority: 1,
					layer: AtemLayers.AtemSuperSourceBoxes,
					content: {
						deviceType: TSR.DeviceType.ATEM,
						type: TSR.TimelineContentTypeAtem.SSRC,

						ssrc: {
							boxes,
						},
					},
				}),
			],
		},
	}

	const pieces = [cameraPiece]
	const scriptPiece = createScriptPiece(part.payload.script, part.payload.externalId)
	if (scriptPiece) pieces.push(scriptPiece)

	const graphics = parseGraphicsFromObjects(config, part.objects)
	if (graphics.pieces) pieces.push(...graphics.pieces)

	return {
		part: {
			externalId: part.payload.externalId,
			title: part.payload.name,

			expectedDuration: part.payload.duration,
		},
		pieces,
		adLibPieces: [...graphics.adLibPieces],
	}
}
