import { forwardRef } from "react";
import * as Icons from "@phosphor-icons/react";

type Props = {
    icon: string;
} & Icons.IconProps;

const Icon = forwardRef<SVGSVGElement, Props>(({ icon, ...rest }, ref) => {
    // @ts-ignore
    const IconComponent = Icons[icon];

    if (!IconComponent) {
        return null;
    } else {
        // @ts-ignore
        return <IconComponent ref={ref} {...rest} />;
    }
});

Icon.displayName = "Icon";

export default Icon;
